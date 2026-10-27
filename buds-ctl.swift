import Foundation
import IOBluetooth

class RfcommSender: NSObject, IOBluetoothRFCOMMChannelDelegate {
    let packet: [UInt8]
    var success: Bool = false
    private weak var channel: IOBluetoothRFCOMMChannel?
    
    init(packet: [UInt8]) {
        self.packet = packet
        super.init()
    }

    func rfcommChannelOpenComplete(_ rfcommChannel: IOBluetoothRFCOMMChannel!, status error: IOReturn) {
        guard error == kIOReturnSuccess else {
            CFRunLoopStop(CFRunLoopGetMain())
            return
        }
        
        self.channel = rfcommChannel
        var p = packet
        let writeRes = p.withUnsafeMutableBytes { ptr in
            rfcommChannel.writeSync(ptr.baseAddress, length: UInt16(ptr.count))
        }
        if writeRes == kIOReturnSuccess {
            self.success = true
        }
        
        // Safety timeout in case earbud doesn't reply ACK
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            if let ch = self?.channel, ch.isOpen() {
                ch.close()
            }
            CFRunLoopStop(CFRunLoopGetMain())
        }
    }

    func rfcommChannelData(_ rfcommChannel: IOBluetoothRFCOMMChannel!, data dataPointer: UnsafeMutableRawPointer!, length dataLength: Int) {
        // Earbud ACK received (e.g. AA 08 00 00 04 84 01 01 00 00)
        self.success = true
        rfcommChannel.close()
        CFRunLoopStop(CFRunLoopGetMain())
    }

    func rfcommChannelClosed(_ rfcommChannel: IOBluetoothRFCOMMChannel!) {
        CFRunLoopStop(CFRunLoopGetMain())
    }
}

func normalizeAddress(_ addr: String) -> String {
    return addr.replacingOccurrences(of: "-", with: ":").uppercased()
}

func findTargetDevice(explicitAddress: String? = nil) -> IOBluetoothDevice? {
    if let explicit = explicitAddress, !explicit.isEmpty {
        let norm = normalizeAddress(explicit)
        if let dev = IOBluetoothDevice(addressString: norm) {
            return dev
        }
    }
    
    // Auto-detect from paired devices
    if let paired = IOBluetoothDevice.pairedDevices() as? [IOBluetoothDevice] {
        // 1. Prioritize currently connected Realme / T310 / Buds devices
        for dev in paired where dev.isConnected() {
            let name = (dev.name ?? "").lowercased()
            if name.contains("realme") || name.contains("t310") || name.contains("buds") {
                return dev
            }
        }
        
        // 2. Fallback to any paired Realme / T310 device
        for dev in paired {
            let name = (dev.name ?? "").lowercased()
            if name.contains("realme") || name.contains("t310") {
                return dev
            }
        }
    }
    
    // 3. Fallback to default address if known
    return IOBluetoothDevice(addressString: "84:9D:4B:FA:59:55")
}

func sendCommand(device: IOBluetoothDevice, packet: [UInt8]) -> Bool {
    guard device.isConnected() else { return false }
    
    // Try primary channel 1 (Realme SPP), fallback to channel 6 and 5
    for chId: BluetoothRFCOMMChannelID in [1, 6, 5] {
        let sender = RfcommSender(packet: packet)
        var channel: IOBluetoothRFCOMMChannel? = nil
        let res = device.openRFCOMMChannelSync(&channel, withChannelID: chId, delegate: sender)
        if res == kIOReturnSuccess {
            CFRunLoopRunInMode(CFRunLoopMode.defaultMode, 0.8, false)
            if sender.success {
                return true
            }
        }
    }
    return false
}

func getBluetoothInfo(explicitAddress: String? = nil) -> [String: Any] {
    guard let dev = findTargetDevice(explicitAddress: explicitAddress) else {
        return ["connected": false]
    }
    
    let isConnected = dev.isConnected()
    let devName = dev.name ?? "realme Buds T310"
    let devAddr = normalizeAddress(dev.addressString ?? "")
    
    if !isConnected {
        return [
            "connected": false,
            "name": devName,
            "address": devAddr
        ]
    }
    
    // Query system_profiler for battery information
    var batteryVal = 100
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/sbin/system_profiler")
    process.arguments = ["SPBluetoothDataType", "-json"]
    let pipe = Pipe()
    process.standardOutput = pipe
    do {
        try process.run()
        process.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
           let btList = json["SPBluetoothDataType"] as? [[String: Any]],
           let first = btList.first,
           let connectedList = first["device_connected"] as? [[String: [String: Any]]] {
            for item in connectedList {
                for (name, props) in item {
                    let propAddr = normalizeAddress((props["device_address"] as? String) ?? "")
                    let nameMatches = name.lowercased().contains("realme") || name.lowercased().contains("t310")
                    let addrMatches = !devAddr.isEmpty && propAddr == devAddr
                    
                    if addrMatches || nameMatches {
                        if let batStr = (props["device_batteryLevelMain"] as? String) ??
                                       (props["device_batteryLevelLeft"] as? String) ??
                                       (props["device_batteryLevelRight"] as? String) {
                            let digits = batStr.filter { "0123456789".contains($0) }
                            if let b = Int(digits) {
                                batteryVal = b
                            }
                        }
                    }
                }
            }
        }
    } catch {
        // Fallback to default
    }
    
    return [
        "connected": true,
        "name": devName,
        "address": devAddr,
        "battery": batteryVal
    ]
}

let stateFilePath = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".budsbar-state.json").path

func loadPersistedState() -> [String: Any] {
    if let data = try? Data(contentsOf: URL(fileURLWithPath: stateFilePath)),
       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
        return json
    }
    return [
        "anc": "off",
        "game": false,
        "eq": "bass_boost"
    ]
}

func savePersistedState(_ dict: [String: Any]) {
    var current = loadPersistedState()
    for (k, v) in dict {
        current[k] = v
    }
    if let data = try? JSONSerialization.data(withJSONObject: current, options: .prettyPrinted) {
        try? data.write(to: URL(fileURLWithPath: stateFilePath))
    }
}

func outputStatusAndExit(explicitAddress: String? = nil) -> Never {
    var result = getBluetoothInfo(explicitAddress: explicitAddress)
    let persisted = loadPersistedState()
    for (k, v) in persisted {
        if k != "connected" && k != "name" && k != "address" && k != "battery" {
            result[k] = v
        }
    }
    if let data = try? JSONSerialization.data(withJSONObject: result),
       let str = String(data: data, encoding: .utf8) {
        print(str)
        exit(0)
    }
    print("{\"connected\":false}")
    exit(0)
}

// Command Line Parsing
var args = Array(CommandLine.arguments.dropFirst())

// Parse optional --address <MAC>
var explicitAddress: String? = nil
if let addrIdx = args.firstIndex(of: "--address"), addrIdx + 1 < args.count {
    explicitAddress = args[addrIdx + 1]
    args.removeSubrange(addrIdx...(addrIdx + 1))
}

let cmd = args.first ?? "status"

switch cmd {
case "status":
    outputStatusAndExit(explicitAddress: explicitAddress)

case "anc":
    guard args.count > 1 else {
        print("{\"error\":\"missing_mode\",\"expected\":[\"cancellation\",\"off\",\"transparency\"]}")
        exit(1)
    }
    let mode = args[1].lowercased()
    var modeByte: UInt8 = 0x08
    var normalized = "cancellation"
    if mode == "transparency" || mode == "transparent" {
        modeByte = 0x02
        normalized = "transparency"
    } else if mode == "off" || mode == "normal" {
        modeByte = 0x01
        normalized = "off"
    } else {
        modeByte = 0x08
        normalized = "cancellation"
    }
    
    guard let device = findTargetDevice(explicitAddress: explicitAddress) else {
        print("{\"status\":\"fail\",\"error\":\"device_not_found\"}")
        exit(1)
    }
    
    // Command 1028 (0x0404) in Little Endian framed with OPPOv1 (AA 0A 00 00 ...)
    let packet: [UInt8] = [0xAA, 0x0A, 0x00, 0x00, 0x04, 0x04, 0x01, 0x03, 0x00, 0x01, 0x01, modeByte]
    let ok = sendCommand(device: device, packet: packet)
    if ok {
        savePersistedState(["anc": normalized])
    }
    print("{\"status\":\"\(ok ? "ok" : "fail")\",\"anc\":\"\(normalized)\"}")
    exit(ok ? 0 : 1)

case "game":
    guard args.count > 1 else {
        print("{\"error\":\"missing_state\",\"expected\":[\"on\",\"off\"]}")
        exit(1)
    }
    let isEnabled = args[1] == "on" || args[1] == "true" || args[1] == "1"
    
    guard let device = findTargetDevice(explicitAddress: explicitAddress) else {
        print("{\"status\":\"fail\",\"error\":\"device_not_found\"}")
        exit(1)
    }
    
    // Command 1027 (0x0403) feature 6 framed with OPPOv1
    let packet: [UInt8] = [0xAA, 0x09, 0x00, 0x00, 0x03, 0x04, 0x01, 0x02, 0x00, 0x06, isEnabled ? 0x01 : 0x00]
    let ok = sendCommand(device: device, packet: packet)
    if ok {
        savePersistedState(["game": isEnabled])
    }
    print("{\"status\":\"\(ok ? "ok" : "fail")\",\"game\":\(isEnabled)}")
    exit(ok ? 0 : 1)

case "eq":
    guard args.count > 1 else {
        print("{\"error\":\"missing_preset\",\"expected\":[\"bass_boost\",\"clear_vocals\",\"bright\",\"balanced\"]}")
        exit(1)
    }
    let preset = args[1].lowercased()
    var eqByte: UInt8 = 0x00
    if preset == "bass_boost" { eqByte = 0x01 }
    else if preset == "clear_vocals" { eqByte = 0x00 }
    else if preset == "bright" { eqByte = 0x02 }
    else if preset == "balanced" { eqByte = 0x00 }
    
    guard let device = findTargetDevice(explicitAddress: explicitAddress) else {
        print("{\"status\":\"fail\",\"error\":\"device_not_found\"}")
        exit(1)
    }
    
    // Command 1030 (0x0406) framed with OPPOv1
    let packet: [UInt8] = [0xAA, 0x08, 0x00, 0x00, 0x06, 0x04, 0x01, 0x01, 0x00, eqByte]
    let ok = sendCommand(device: device, packet: packet)
    if ok {
        savePersistedState(["eq": preset])
    }
    print("{\"status\":\"\(ok ? "ok" : "fail")\",\"eq\":\"\(preset)\"}")
    exit(ok ? 0 : 1)

case "--help", "-h", "help":
    print("""
    BudsBar Control Utility (buds-ctl)
    Usage:
      buds-ctl status [--address <MAC>]
      buds-ctl anc <cancellation|off|transparency> [--address <MAC>]
      buds-ctl game <on|off> [--address <MAC>]
      buds-ctl eq <bass_boost|clear_vocals|bright|balanced> [--address <MAC>]
    """)
    exit(0)

default:
    outputStatusAndExit(explicitAddress: explicitAddress)
}

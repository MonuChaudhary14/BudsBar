import Foundation
import IOBluetooth

class RfcommSender: NSObject, IOBluetoothRFCOMMChannelDelegate {
    let packet: [UInt8]
    var success: Bool = false
    
    init(packet: [UInt8]) {
        self.packet = packet
        super.init()
    }

    func rfcommChannelOpenComplete(_ rfcommChannel: IOBluetoothRFCOMMChannel!, status error: IOReturn) {
        if error == kIOReturnSuccess {
            var p = packet
            let writeRes = rfcommChannel.writeSync(&p, length: UInt16(p.count))
            if writeRes == kIOReturnSuccess {
                self.success = true
            }
            // Give 0.25s for earbud to process and reply ACK
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                rfcommChannel.close()
                CFRunLoopStop(CFRunLoopGetCurrent())
            }
        } else {
            CFRunLoopStop(CFRunLoopGetCurrent())
        }
    }

    func rfcommChannelData(_ rfcommChannel: IOBluetoothRFCOMMChannel!, data dataPointer: UnsafeMutableRawPointer!, length dataLength: Int) {
        // Read response ACK (e.g. AA 08 00 00 04 84 01 01 00 00)
        self.success = true
    }

    func rfcommChannelClosed(_ rfcommChannel: IOBluetoothRFCOMMChannel!) {
        CFRunLoopStop(CFRunLoopGetCurrent())
    }
}

func sendCommand(address: String, packet: [UInt8]) -> Bool {
    guard let device = IOBluetoothDevice(addressString: address) else { return false }
    if !device.isConnected() {
        return false
    }
    
    // Try primary channel 1 (Realme/TL SPP), fallback to channel 6
    for chId: BluetoothRFCOMMChannelID in [1, 6] {
        let sender = RfcommSender(packet: packet)
        var channel: IOBluetoothRFCOMMChannel? = nil
        let res = device.openRFCOMMChannelSync(&channel, withChannelID: chId, delegate: sender)
        if res == kIOReturnSuccess {
            CFRunLoopRunInMode(CFRunLoopMode.defaultMode, 1.0, false)
            if sender.success {
                return true
            }
        }
    }
    return false
}

func getBluetoothInfo() -> [String: Any] {
    // 1. Direct native check via IOBluetooth (instantaneous and authoritative)
    var targetDevice: IOBluetoothDevice? = nil
    if let paired = IOBluetoothDevice.pairedDevices() as? [IOBluetoothDevice] {
        for dev in paired {
            let name = dev.name ?? ""
            let addr = dev.addressString?.replacingOccurrences(of: "-", with: ":").uppercased() ?? ""
            if name.lowercased().contains("realme") || name.lowercased().contains("t310") || addr == "84:9D:4B:FA:59:55" {
                targetDevice = dev
                break
            }
        }
    }
    
    if targetDevice == nil {
        targetDevice = IOBluetoothDevice(addressString: "84:9D:4B:FA:59:55")
    }
    
    guard let dev = targetDevice else {
        return ["connected": false]
    }
    
    let isConnected = dev.isConnected()
    let devName = dev.name ?? "realme Buds T310"
    let devAddr = dev.addressString?.replacingOccurrences(of: "-", with: ":").uppercased() ?? "84:9D:4B:FA:59:55"
    
    if !isConnected {
        return [
            "connected": false,
            "name": devName,
            "address": devAddr
        ]
    }
    
    // 2. Only if device is actually connected, query battery info
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
                    if name.lowercased().contains("realme") || name.lowercased().contains("t310") {
                        if let batStr = props["device_batteryLevelMain"] as? String {
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
        // Fallback
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

// Command Line Parsing
let args = CommandLine.arguments

if args.count > 1 {
    let cmd = args[1]
    
    if cmd == "status" {
        var result = getBluetoothInfo()
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
    
    let targetAddr = "84:9D:4B:FA:59:55"

    if cmd == "anc" && args.count > 2 {
        let mode = args[2].lowercased()
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
        
        // Command 1028 (0x0404) in Little Endian framed with OPPOv1 (AA 0A 00 00 ...)
        let packet: [UInt8] = [0xAA, 0x0A, 0x00, 0x00, 0x04, 0x04, 0x01, 0x03, 0x00, 0x01, 0x01, modeByte]
        let ok = sendCommand(address: targetAddr, packet: packet)
        if ok {
            savePersistedState(["anc": normalized])
        }
        print("{\"status\":\"\(ok ? "ok" : "fail")\",\"anc\":\"\(normalized)\"}")
        exit(0)
    }

    if cmd == "game" && args.count > 2 {
        let isEnabled = args[2] == "on" || args[2] == "true" || args[2] == "1"
        // Command 1027 (0x0403) feature 6 framed with OPPOv1
        let packet: [UInt8] = [0xAA, 0x09, 0x00, 0x00, 0x03, 0x04, 0x01, 0x02, 0x00, 0x06, isEnabled ? 0x01 : 0x00]
        let ok = sendCommand(address: targetAddr, packet: packet)
        if ok {
            savePersistedState(["game": isEnabled])
        }
        print("{\"status\":\"\(ok ? "ok" : "fail")\",\"game\":\(isEnabled)}")
        exit(0)
    }

    if cmd == "eq" && args.count > 2 {
        let preset = args[2].lowercased()
        var eqByte: UInt8 = 0x00 // Default: Clear Vocals
        if preset == "bass_boost" { eqByte = 0x01 }
        else if preset == "clear_vocals" { eqByte = 0x00 }
        else if preset == "bright" { eqByte = 0x02 }
        else if preset == "balanced" { eqByte = 0x00 }
        
        // Command 1030 (0x0406) framed with OPPOv1
        let packet: [UInt8] = [0xAA, 0x08, 0x00, 0x00, 0x06, 0x04, 0x01, 0x01, 0x00, eqByte]
        let ok = sendCommand(address: targetAddr, packet: packet)
        if ok {
            savePersistedState(["eq": preset])
        }
        print("{\"status\":\"\(ok ? "ok" : "fail")\",\"eq\":\"\(preset)\"}")
        exit(0)
    }
}

// Default
var result = getBluetoothInfo()
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

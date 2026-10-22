import Foundation
import IOBluetooth

class RfcommDelegate: NSObject, IOBluetoothRFCOMMChannelDelegate {
    let modeName: String
    let packet: [UInt8]

    init(modeName: String, packet: [UInt8]) {
        self.modeName = modeName
        self.packet = packet
        super.init()
    }

    func rfcommChannelOpenComplete(_ rfcommChannel: IOBluetoothRFCOMMChannel!, status error: IOReturn) {
        if error == kIOReturnSuccess {
            print("RFCOMM connected on channel \(rfcommChannel.getID())")
            var p = packet
            let ret = rfcommChannel.writeSync(&p, length: UInt16(p.count))
            print("Sent \(modeName) command (ret=\(ret)): \(packet.map { String(format: "%02X", $0) }.joined(separator: " "))")
        } else {
            print("Error connecting: \(error)")
            exit(1)
        }
    }

    func rfcommChannelData(_ rfcommChannel: IOBluetoothRFCOMMChannel!, data dataPointer: UnsafeMutableRawPointer!, length dataLength: Int) {
        let buffer = UnsafeBufferPointer(start: dataPointer.assumingMemoryBound(to: UInt8.self), count: dataLength)
        let hex = buffer.map { String(format: "%02X", $0) }.joined(separator: " ")
        print("Response received from earbuds: \(hex)")
        CFRunLoopStop(CFRunLoopGetCurrent())
    }

    func rfcommChannelClosed(_ rfcommChannel: IOBluetoothRFCOMMChannel!) {
        CFRunLoopStop(CFRunLoopGetCurrent())
    }
}

guard let device = IOBluetoothDevice(addressString: "84:9D:4B:FA:59:55") else {
    print("Device not found")
    exit(1)
}

// 0x08 = Noise Cancellation (46dB)
// 0x02 = Normal / Off
// 0x01 = Transparency / Ambient
let ancPacket: [UInt8] = [0x04, 0x04, 0x01, 0x03, 0x00, 0x01, 0x01, 0x08]

let delegate = RfcommDelegate(modeName: "Noise Cancellation", packet: ancPacket)
var channel: IOBluetoothRFCOMMChannel? = nil
let res = device.openRFCOMMChannelSync(&channel, withChannelID: 5, delegate: delegate)

if res == kIOReturnSuccess {
    CFRunLoopRunInMode(CFRunLoopMode.defaultMode, 2.0, false)
} else {
    print("openRFCOMMChannelSync failed: \(res)")
}

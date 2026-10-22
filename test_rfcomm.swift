import Foundation
import IOBluetooth

class RfcommDelegate: NSObject, IOBluetoothRFCOMMChannelDelegate {
    func rfcommChannelOpenComplete(_ rfcommChannel: IOBluetoothRFCOMMChannel!, status error: IOReturn) {
        if error == kIOReturnSuccess {
            print("RFCOMM Channel successfully opened on channel \(rfcommChannel.getID())!")
            // RACE get battery packet: 05 5A 00 04 0C 02 01 00
            var packet: [UInt8] = [0x05, 0x5a, 0x00, 0x04, 0x0c, 0x02, 0x01, 0x00]
            let ret = rfcommChannel.writeSync(&packet, length: UInt16(packet.count))
            print("Write result: \(ret)")
        } else {
            print("Failed to open RFCOMM channel: \(error)")
            exit(1)
        }
    }

    func rfcommChannelData(_ rfcommChannel: IOBluetoothRFCOMMChannel!, data dataPointer: UnsafeMutableRawPointer!, length dataLength: Int) {
        let buffer = UnsafeBufferPointer(start: dataPointer.assumingMemoryBound(to: UInt8.self), count: dataLength)
        let hex = buffer.map { String(format: "%02X", $0) }.joined(separator: " ")
        print("Received from earbud: \(hex)")
        CFRunLoopStop(CFRunLoopGetCurrent())
    }

    func rfcommChannelClosed(_ rfcommChannel: IOBluetoothRFCOMMChannel!) {
        print("RFCOMM Channel closed")
        CFRunLoopStop(CFRunLoopGetCurrent())
    }
}

guard let device = IOBluetoothDevice(addressString: "84:9D:4B:FA:59:55") else {
    print("Device not found")
    exit(1)
}

let delegate = RfcommDelegate()
var channel: IOBluetoothRFCOMMChannel? = nil
let res = device.openRFCOMMChannelSync(&channel, withChannelID: 5, delegate: delegate)
print("openRFCOMMChannelSync returned: \(res)")

if res == kIOReturnSuccess {
    // Run for 3 seconds
    CFRunLoopRunInMode(CFRunLoopMode.defaultMode, 3, false)
}

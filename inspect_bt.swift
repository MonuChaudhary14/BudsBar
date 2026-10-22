import Foundation
import IOBluetooth

guard let device = IOBluetoothDevice(addressString: "84:9D:4B:FA:59:55") else {
    print("Could not find device by address")
    exit(1)
}

print("Device Name: \(device.name ?? "Unknown")")
print("Is Connected: \(device.isConnected())")
print("Class of Device: \(device.classOfDevice)")
if let services = device.services as? [IOBluetoothSDPServiceRecord] {
    print("Services count: \(services.count)")
    for record in services {
        print("---")
        print("Service Name: \(record.getServiceName() ?? "Unknown")")
        var channelID: BluetoothRFCOMMChannelID = 0
        if record.getRFCOMMChannelID(&channelID) == kIOReturnSuccess {
            print("RFCOMM Channel: \(channelID)")
        }
    }
}

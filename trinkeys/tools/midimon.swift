import CoreMIDI
import Foundation
// midimon [seconds]: lists every MIDI source and destination, then prints each message received
// from all sources for the given number of seconds (default 5).
//   swiftc -O -o /tmp/midimon midimon.swift && /tmp/midimon 10
let secs = CommandLine.arguments.count > 1 ? Double(CommandLine.arguments[1]) ?? 5 : 5
func name(_ obj: MIDIObjectRef) -> String {
    var s: Unmanaged<CFString>?
    MIDIObjectGetStringProperty(obj, kMIDIPropertyDisplayName, &s)
    return s?.takeRetainedValue() as String? ?? "?"
}
var client = MIDIClientRef()
MIDIClientCreateWithBlock("midimon" as CFString, &client) { _ in }
var port = MIDIPortRef()
let t0 = Date()
MIDIInputPortCreateWithProtocol(client, "in" as CFString, ._1_0, &port) { list, srcRef in
    let src = srcRef?.load(as: MIDIObjectRef.self) ?? 0
    for p in list.unsafeSequence() {
        for word in p.words() {   // UMP words for MIDI 1.0 channel voice: 0x2g ss d1 d2
            let status = (word >> 16) & 0xff, d1 = (word >> 8) & 0x7f, d2 = word & 0x7f
            if status < 0x80 { continue }
            print(String(format: "%6.2fs  %-22@  %02X %3d %3d", Date().timeIntervalSince(t0), name(src) as NSString, status, d1, d2))
            fflush(stdout)
        }
    }
}
print("sources:")
for i in 0..<MIDIGetNumberOfSources() {
    let s = MIDIGetSource(i)
    var r = s
    print("  ", name(s))
    MIDIPortConnectSource(port, s, &r)
}
print("destinations:")
for i in 0..<MIDIGetNumberOfDestinations() { print("  ", name(MIDIGetDestination(i))) }
print("listening \(secs)s …")
RunLoop.current.run(until: Date().addingTimeInterval(secs))

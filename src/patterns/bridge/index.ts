import type { PatternDefinition } from '@/types/pattern'

export const pattern: PatternDefinition = {
  slug: 'bridge',
  name: 'Bridge',
  category: 'structural',
  order: 6,
  summary: 'Split an abstraction from its implementation so the two can vary independently.',
  intent:
    'Decouple an abstraction from its implementation so that the two can evolve, and vary, independently of one another.',
  problem:
    'A remote control needs to work with many kinds of devices — TVs, radios, maybe a projector next year — and there are also several kinds of remotes: a basic one and an advanced one with extra buttons. Modeling this with inheritance alone (BasicTVRemote, AdvancedTVRemote, BasicRadioRemote, AdvancedRadioRemote…) multiplies every new remote type by every new device type: with M remote kinds and N device kinds you need M × N subclasses, so each new device or remote adds a whole row or column of classes.',
  solution:
    "Split the two dimensions into separate hierarchies. RemoteControl (the abstraction) holds a reference to a Device (the implementor interface) instead of extending a concrete device class. New remotes extend RemoteControl; new devices implement Device. Either hierarchy can grow on its own, and any remote can be paired with any device at runtime through the reference that bridges them. Bridge is a structural split of two hierarchies decided up front at design time, which is different from Strategy, where a single class swaps out one interchangeable algorithm.",
  analogy:
    'A universal remote and the appliances it points at. The remote does not care whether it is pointed at a TV or a radio — it just sends "power" and "volume" signals through the same bridge, and the appliance on the other end decides how to act on them.',
  whenToUse: [
    'You want to avoid a permanent binding between an abstraction and one implementation, so either can be chosen or swapped at runtime.',
    'Both the abstraction and the implementation should be extensible through subclassing, independently of each other.',
    'A class hierarchy is exploding because it is really modeling two independent dimensions of variation.',
  ],
  pros: [
    'Abstraction and implementation can be extended independently, without touching each other.',
    'Swaps the concrete implementation at runtime, even after the abstraction object already exists.',
    'Avoids a combinatorial explosion of classes for every abstraction × implementation pairing.',
  ],
  cons: [
    'Adds indirection and an extra interface that a simpler design might not need.',
    'Designing the right Device interface upfront takes more care than reaching for inheritance.',
  ],
  realWorld: [
    'JDBC / ODBC drivers bridging a common database API to many vendor-specific engines',
    'Cross-platform UI toolkits bridging a Window abstraction to per-OS rendering implementations',
    'Graphics APIs bridging a Shape abstraction to different rendering backends (raster, vector, GPU)',
    'Logger front-ends bridging a logging API to swappable backends (console, file, remote service)',
  ],
  related: ['adapter', 'abstract-factory', 'strategy', 'state'],
  participants: [
    {
      id: 'device',
      label: 'Device',
      role: 'Implementor interface',
      kind: 'interface',
      x: 620,
      y: 70,
      width: 140,
      description: 'Declares the low-level operations every device supports: turnOn, turnOff, setVolume. RemoteControl depends only on this.',
    },
    {
      id: 'tv',
      label: 'TV',
      role: 'Concrete Implementor',
      kind: 'class',
      x: 560,
      y: 230,
      width: 120,
      description: 'Implements Device for a television, logging "tv: …" for each operation.',
    },
    {
      id: 'radio',
      label: 'Radio',
      role: 'Concrete Implementor',
      kind: 'class',
      x: 700,
      y: 350,
      width: 120,
      description: 'Implements Device for a radio, logging "radio: …" for each operation.',
    },
    {
      id: 'remoteControl',
      label: 'RemoteControl',
      role: 'Abstraction',
      kind: 'class',
      x: 330,
      y: 120,
      width: 190,
      description: 'Holds a Device and exposes a high-level API (togglePower). It delegates every operation to the device it holds, never to a concrete class.',
    },
    {
      id: 'advancedRemote',
      label: 'AdvancedRemoteControl',
      role: 'Refined Abstraction',
      kind: 'class',
      x: 330,
      y: 320,
      width: 230,
      description: 'Extends RemoteControl with an extra operation, mute(), built on the very same Device reference it inherited.',
    },
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 100,
      y: 230,
      description: 'Picks any remote and pairs it with any device, then programs against RemoteControl without caring which device is on the other end of the bridge.',
    },
  ],
  relations: [
    {
      id: 'tv-impl',
      from: 'tv',
      to: 'device',
      type: 'implements',
      description: 'TV implements the Device interface.',
      bend: 20,
    },
    {
      id: 'radio-impl',
      from: 'radio',
      to: 'device',
      type: 'implements',
      description: 'Radio implements the Device interface.',
      bend: -15,
    },
    {
      id: 'extends',
      from: 'advancedRemote',
      to: 'remoteControl',
      type: 'implements',
      description: 'AdvancedRemoteControl extends RemoteControl, inheriting its device reference and togglePower() for free.',
      code: 'advancedRemote',
    },
    {
      id: 'bridge',
      from: 'remoteControl',
      to: 'device',
      type: 'holds',
      label: 'device',
      description: 'The bridge itself: RemoteControl stores its device typed as Device — never as TV or Radio. This reference is what lets the two hierarchies vary independently.',
      bend: 15,
      code: 'holds',
    },
    {
      id: 'toggle-device',
      from: 'remoteControl',
      to: 'device',
      type: 'calls',
      label: 'turnOn()/turnOff()',
      description: 'togglePower() delegates straight to the device through the bridge reference, regardless of which concrete device it is.',
      bend: -30,
      code: 'togglePower',
    },
    {
      id: 'mute-device',
      from: 'advancedRemote',
      to: 'device',
      type: 'calls',
      label: 'setVolume(0)',
      description: 'mute() is new behaviour added by the refined abstraction, but it still goes through the same inherited device reference.',
      bend: 25,
      code: 'mute',
    },
    {
      id: 'client-creates-remote',
      from: 'client',
      to: 'remoteControl',
      type: 'creates',
      label: 'new RemoteControl(device)',
      description: 'The client constructs a RemoteControl, choosing at that moment which concrete device it will control.',
      bend: -20,
      code: 'usage',
    },
    {
      id: 'client-remote',
      from: 'client',
      to: 'remoteControl',
      type: 'calls',
      label: 'togglePower()',
      description: 'The client calls the same togglePower() method no matter which device is behind it.',
      bend: 20,
      code: 'usage',
    },
    {
      id: 'client-sets-device',
      from: 'client',
      to: 'remoteControl',
      type: 'calls',
      label: 'setDevice(radio)',
      description: 'The client swaps the implementor at runtime by calling setDevice() on the already-constructed remote, pointing the same bridge reference at a different Device.',
      bend: 20,
      code: 'setDevice',
    },
    {
      id: 'client-creates-advanced',
      from: 'client',
      to: 'advancedRemote',
      type: 'creates',
      label: 'new AdvancedRemoteControl(device)',
      description: 'The client can just as easily construct the refined abstraction instead, again choosing any device.',
      bend: -20,
      code: 'usage',
    },
    {
      id: 'client-advanced',
      from: 'client',
      to: 'advancedRemote',
      type: 'calls',
      label: 'togglePower()/mute()',
      description: 'The client calls both the inherited togglePower() and the new mute() on the refined abstraction.',
      bend: 20,
      code: 'usage',
    },
  ],
  steps: [
    {
      title: 'Build a remote around a TV',
      description: 'The client constructs a plain RemoteControl, handing it a TV through the constructor. From this point on, RemoteControl only ever refers to it as a Device.',
      highlight: ['client', 'client-creates-remote', 'remoteControl', 'bridge', 'device', 'tv', 'tv-impl'],
      packets: [{ relation: 'client-creates-remote', label: 'new RemoteControl(tv)' }],
      notes: { remoteControl: 'device: TV' },
      code: 'usage',
    },
    {
      title: 'Client toggles power',
      description: 'The client calls togglePower(). RemoteControl does not know it is holding a TV — it just calls turnOn() through the Device reference, and the TV switches on.',
      highlight: ['client', 'client-remote', 'remoteControl', 'toggle-device', 'tv'],
      packets: [
        { relation: 'client-remote', label: 'togglePower()' },
        { relation: 'toggle-device', label: 'turnOn()' },
      ],
      notes: { tv: 'on' },
      code: 'togglePower',
    },
    {
      title: 'Swap the implementor',
      description: 'Without changing a single line of RemoteControl, the client calls setDevice() on the very same remote to point its bridge reference at a Radio instead. The abstraction hierarchy never had to know Radio existed, and no new RemoteControl had to be built.',
      highlight: ['client', 'client-sets-device', 'remoteControl', 'bridge', 'radio', 'radio-impl'],
      packets: [{ relation: 'client-sets-device', label: 'setDevice(radio)' }],
      notes: { remoteControl: 'device: Radio' },
      code: 'setDevice',
    },
    {
      title: 'Same call, different device',
      description: 'The client calls togglePower() again — the exact same call as before. This time it is the Radio that receives turnOn(), proving the two hierarchies really do vary independently.',
      highlight: ['client', 'client-remote', 'remoteControl', 'toggle-device', 'radio'],
      packets: [
        { relation: 'client-remote', label: 'togglePower()' },
        { relation: 'toggle-device', label: 'turnOn()' },
      ],
      notes: { radio: 'on' },
      code: 'togglePower',
    },
    {
      title: 'Extend the abstraction side instead',
      description: 'The client now builds an AdvancedRemoteControl — a refined abstraction — around a TV. It inherits everything RemoteControl already does, plus a new mute() operation.',
      highlight: ['client', 'client-creates-advanced', 'advancedRemote', 'extends', 'remoteControl', 'bridge', 'tv'],
      packets: [{ relation: 'client-creates-advanced', label: 'new AdvancedRemoteControl(tv)' }],
      notes: { advancedRemote: 'device: TV' },
      code: 'usage',
    },
    {
      title: 'Inherited behaviour still works',
      description: 'The client calls togglePower() on the advanced remote. It reuses the base class delegation logic unchanged, through the same inherited device reference.',
      highlight: ['client', 'client-advanced', 'advancedRemote', 'toggle-device', 'tv'],
      packets: [
        { relation: 'client-advanced', label: 'togglePower()' },
        { relation: 'toggle-device', label: 'turnOn()' },
      ],
      notes: { tv: 'on' },
      code: 'togglePower',
    },
    {
      title: 'A new operation, the same bridge',
      description: 'The client calls mute(), an operation only the refined abstraction has. It still goes straight through the Device reference, calling setVolume(0) on whatever device is attached.',
      highlight: ['client', 'client-advanced', 'advancedRemote', 'mute-device', 'tv'],
      packets: [
        { relation: 'client-advanced', label: 'mute()' },
        { relation: 'mute-device', label: 'setVolume(0)' },
      ],
      notes: { tv: '0%' },
      code: 'mute',
    },
    {
      title: 'Two hierarchies, one bridge',
      description: 'RemoteControl and AdvancedRemoteControl can grow on the abstraction side; TV and Radio can grow on the implementation side. Neither hierarchy has to touch the other — the Device reference is the only thing connecting them.',
      highlight: ['remoteControl', 'advancedRemote', 'extends', 'bridge', 'device', 'tv', 'radio', 'tv-impl', 'radio-impl'],
      code: 'remoteControl',
    },
  ],
  code: `
// [device]
interface Device {
  isOn: boolean
  volume: number
  turnOn(): void
  turnOff(): void
  setVolume(percent: number): void
}
// [/device]

// [tv]
class TV implements Device {
  isOn = false
  volume = 30

  turnOn() {
    this.isOn = true
    console.log('tv: on')
  }
  turnOff() {
    this.isOn = false
    console.log('tv: off')
  }
  setVolume(percent: number) {
    this.volume = percent
    console.log(\`tv: volume \${percent}%\`)
  }
}
// [/tv]

// [radio]
class Radio implements Device {
  isOn = false
  volume = 30

  turnOn() {
    this.isOn = true
    console.log('radio: on')
  }
  turnOff() {
    this.isOn = false
    console.log('radio: off')
  }
  setVolume(percent: number) {
    this.volume = percent
    console.log(\`radio: volume \${percent}%\`)
  }
}
// [/radio]

// [remoteControl]
class RemoteControl {
  // [holds]
  constructor(protected device: Device) {}
  // [/holds]

  // [togglePower]
  togglePower() {
    if (this.device.isOn) this.device.turnOff()
    else this.device.turnOn()
  }
  // [/togglePower]

  // [setDevice]
  setDevice(device: Device) {
    this.device = device
  }
  // [/setDevice]
}
// [/remoteControl]

// [advancedRemote]
class AdvancedRemoteControl extends RemoteControl {
  // [mute]
  mute() {
    this.device.setVolume(0)
  }
  // [/mute]
}
// [/advancedRemote]

// [usage]
// Usage
const remote = new RemoteControl(new TV())
remote.togglePower() // tv: on

remote.setDevice(new Radio())
remote.togglePower() // radio: on

const advanced = new AdvancedRemoteControl(new TV())
advanced.togglePower() // tv: on
advanced.mute() // tv: volume 0%
// [/usage]
`,
}

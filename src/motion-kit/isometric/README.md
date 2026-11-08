# Isometric SVG assets

`IsoCar` is the first asset: an illustrative generic MPV/SUV, not a particular
manufacturer or a mechanically accurate vehicle. All visible art is SVG.

```tsx
import { IsoCar } from '@/motion-kit/isometric';

<IsoCar color="#CF5A3C" windowOpen={0.6} wheelRotation={120} />
```

The transparent canvas has a `760 × 480` viewBox. Ground axes project at ±30°;
the view is fixed, and rotation to another camera angle is not supported.
Use an outer SVG/group or element to position and scale the complete asset.

| Prop | Default | Meaning |
| --- | --- | --- |
| `powertrain` | `petrol` | `electric` replaces the combustion engine and petrol underbody components |
| `color` | `#CF5A3C` | Body color, `#RGB` or `#RRGGBB`; shades are derived |
| `windowOpen` | `0` | Both visible side windows: closed `0`, lowered `1` |
| `wheelRotation` | `0` | Degrees, supplied by the scene timeline |
| `bodyOpacity` | `1` | Painted shell opacity; lowering it reveals the cabin and engine |
| `view` | `exterior` | `cutaway` fades the shell and floor; `chassis` hides shell, glass, floor, and seats |
| `hoodOpen` | `0` | Hood raised from closed `0` to 70 degrees `1` |
| `engineRotation` | `0` | Accessory pulley angle in degrees; independent of wheel speed |
| `motorRotation` | `0` | Electric motor shaft detail angle, in degrees |
| `batteryCoverOpacity` | `0.15` | EV traction-battery lid opacity; `0` fully exposes the module illustration |
| `chargePortOpen` | `false` | Open the EV socket flap |
| `energyFlow` | `false` | Show an illustrative battery → inverter → motor → wheel route |
| `energyPhase` | `0` | Loop phase for the moving energy dots; accepts any finite number |
| `wheelOpacity` | `1` exterior, `0.25` chassis | Fade tires and rims to expose brakes and suspension |
| `headlights` | `false` | Bright headlight lens color, without a light beam |
| `shadow` | `true` | Optional ground shadow |
| `title` | `Mobil isometrik` | Accessible image title |

Use Remotion's current frame to compute wheel rotation and window opening. The
asset owns no clock, CSS animation, or random state, so seeking is deterministic.
Opening windows lowers glass within clips; window frames stay in place. Roof and
windshield remain opaque unless shell opacity is lowered. Cabin transparency is
an illustration aid; use `view="chassis"` to remove the floor and inspect the
mechanical layers below it. The engine is a separate component under the hood.

`ISO_CAR_ANCHORS` exposes attachment points in local `[x, y, z]` coordinates.
`projectCarPoint` converts them to the SVG viewBox for labels and flow endpoints.
`data-part` groups identify the shell, cabin, windows, wheels, mirror, and chassis.

Run `npx tsx scripts/assets/preview-iso-car.tsx` to regenerate SVG/PNG examples and
a 10-second MP4 under `storage/assets/iso-car/`. `--stills-only` skips the MP4.
The output includes `pratinjau-mekanik.png` and a labelled `mesin-detail.svg`.
No AI credentials or external image assets are used.

This asset is exported from the motion kit but is not yet selected automatically
by the video generation pipeline. There is no individual window control, road,
steering animation, or internal piston/valve animation.

## Mechanical layers

The schematic uses one explicit layout: a longitudinal front engine with a
transmission, driveshaft, and rear differential. It does not represent every
MPV/SUV drivetrain or any manufacturer's technical drawing.

- Engine bay: finned block, oil pan, cylinder head, valve cover, intake runners,
  airbox, battery with terminals, radiator and hoses, coolant reservoir,
  compressor and accessory pulleys/belt.
- Underbody: ladder rails and crossmembers, tank with straps, transmission,
  driveshaft and rear axle/differential, catalytic-converter/muffler shapes,
  exhaust routing, control arms, springs/dampers, discs and calipers.
- `ISO_CAR_ANCHORS` also includes engine, radiator, compressor, battery,
  transmission, driveshaft, differential, tank, and exhaust endpoints.

The floor no longer extends into the engine bay. `view="chassis"` removes it
entirely so underbody parts can be inspected without the seats obscuring them.
`hoodOpen` rotates the same hood geometry around its rear hinge, rather than
swapping the whole vehicle illustration. The pulleys turn with `engineRotation`;
the belt follows a fixed route and does not yet animate its surface travel.

## Electric variant

```tsx
<IsoCar powertrain="electric" color="#367E83" view="chassis"
  batteryCoverOpacity={0} energyFlow energyPhase={frame / 60}
  motorRotation={frame * -12} />
```

The electric variant uses a schematic front motor and reduction gear, an
underfloor pack with ten illustrated modules, inverter, onboard charger,
auxiliary battery, cooling radiator and pipes, orange high-voltage cables, and
a rear-quarter charging port. The ten modules depict a configurable illustration,
not a battery capacity or the construction of a particular production car.
There is no fuel tank, exhaust, combustion engine, accessory belt, long
driveshaft, or rear differential in this variant. Wheels, cabin, brakes,
suspension, and shell are shared. The traction pack remains below the cabin floor.

Use `ISO_ELECTRIC_CAR_ANCHORS` for EV labels and `ISO_CAR_ANCHORS` for the original
petrol layout. The motor overlay is illustrative; internal rotor/stator operation,
regenerative braking, and a plugged-in charging cable are not implemented.

## Road

`IsoRoad` is an independent SVG asset with 1–4 same-direction lanes, edge lines,
shoulders, and clipped repeating lane marks. `length` defaults to 1100 world
units; `laneWidth` defaults to 240, wide enough for the car's tires. Colors can
be set with `asphalt` and `shoulderColor`. It shares the car's projection origin.

```tsx
<IsoRoad distance={frame * 3}>
  <IsoCar x={104} y={-60} width={760} height={480}
    style={{ width: 760, height: 480 }} />
  <IsoCar powertrain="electric" color="#367E83" x={-104} y={60}
    width={760} height={480} style={{ width: 760, height: 480 }} />
</IsoRoad>
```

The screen offsets above represent lane centers at world y = −120 and +120.
Draw the far-lane car first. Increasing `distance` moves the lane marks backwards;
for matching wheel motion use `wheelRotation={-distance / 40 * 180 / Math.PI}`.
There is no independent road clock, raster texture, or external dependency.

Roads are useful for driving scenes; component close-ups do not require one.
Run `npx tsx scripts/assets/preview-electric-car.tsx` for EV SVG/PNG variants,
a road SVG, a two-car comparison, and a 12-second video under
`storage/assets/iso-electric-car/`. `--stills-only` skips video rendering.
Automatic asset choice from a user prompt is still a separate pipeline task.

# Growth stages (parked for phase 2)

Baby → Kid → Adult growth tied to level, with an evolution celebration.
Removed from the app for now; these files are kept as `.txt` so they aren't compiled.

## Files
- `growth.ts.txt` → `src/data/growth.ts` — stages, level thresholds (baby 1–3, kid 4–7, adult 8+),
  per-stage scale / bob / shared head prop (🌱 / 🍃), and the optional `STAGE_ART` table for
  per-skin stage artwork.
- `EvolutionModal.tsx.txt` → `src/components/EvolutionModal.tsx` — spin + glow → white flash →
  pop-in with sparkles → "Mochi grew into a Kid!" card.

## Wiring to restore
1. **Types** (`src/types/index.ts`): `Creature.stage?: GrowthStage` (last celebrated stage),
   `Memory.stage?: GrowthStage`, and `'evolution'` in `MemoryKind`.
2. **Store** (`src/store/useGameStore.ts`): default `stage: 'baby'`; on load, saves without a
   stage get `stageForLevel(level)` (no surprise evolution); `addMemory` records
   `stage: stageForLevel(level)`; a `completeEvolution(stage)` action sets `creature.stage`
   and adds an `'evolution'` memory.
3. **NubkinCreature**: `stage` prop → body `scale` from `STAGE_LOOK`, bob amplitude/period,
   `STAGE_ART[skinId][stage]` image override, and the shared prop emoji (hidden when an
   accessory is on).
4. **Home**: show `creature.stage` (the celebrated stage, not the level's stage); in the
   modal-queue effect, before anniversaries, open `EvolutionModal` one step at a time
   (`GROWTH_ORDER`) while Home is focused; on close call `completeEvolution`.
5. Pass `stage={creature.stage}` wherever the Nubkin renders (Wardrobe, Shop preview,
   Anniversary party) and `stage={memory.stage ?? 'adult'}` in the Memory Book.
6. Memory Book sticker for `'evolution'`: 🌱. Header can show the stage label.

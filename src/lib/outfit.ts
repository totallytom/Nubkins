import { getCosmeticById } from '../data/cosmetics';

// Turns equipped cosmetic ids into the props NubkinCreature needs to draw them.
export function outfitProps(
  accessoryId: string | null,
  tattooId: string | null,
  specialId: string | null,
) {
  const acc     = accessoryId ? getCosmeticById(accessoryId) : undefined;
  const tattoo  = tattooId    ? getCosmeticById(tattooId)    : undefined;
  const special = specialId   ? getCosmeticById(specialId)   : undefined;
  return {
    accessoryEmoji:      acc?.emoji || null,
    accessoryImage:      acc?.image,
    accessoryImageStyle: acc?.imageStyle,
    tattooImage:         tattoo?.image,
    tattooImageStyle:    tattoo?.imageStyle,
    specialImage:        special?.image,
    specialImageStyle:   special?.imageStyle,
  };
}

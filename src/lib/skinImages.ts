import { ImageSourcePropType } from 'react-native';

export type SkinMoodImages = {
  happy:   ImageSourcePropType;
  neutral: ImageSourcePropType;
  sad:     ImageSourcePropType;
  excited: ImageSourcePropType;
};

const SKIN_IMAGES: Record<string, SkinMoodImages> = {
  'skin-default': {
    happy:   require('../../assets/nubkins/Nubkin1-Happy.png'),
    neutral: require('../../assets/nubkins/Nubkin1-Neutral.png'),
    sad:     require('../../assets/nubkins/Nubkin1-sad.png'),
    excited: require('../../assets/nubkins/Nubkin1-Excitement.png'),
  },
  'skin-nubkin2': {
    happy:   require('../../assets/nubkins/Nubkin2.png'),
    neutral: require('../../assets/nubkins/Nubkin2-Neutral.png'),
    sad:     require('../../assets/nubkins/Nubkin2-sad.png'),
    excited: require('../../assets/nubkins/Nubkin2-Excitement.png'),
  },
  'skin-pinubs': {
    happy:   require('../../assets/nubkins/pinubs/Pinub-happy.png'),
    neutral: require('../../assets/nubkins/pinubs/pinub-neutral.png'),
    sad:     require('../../assets/nubkins/pinubs/pinub-sad.png'),
    excited: require('../../assets/nubkins/pinubs/pinub-excited.png'),
  },
  'skin-jerry': {
    happy:   require('../../assets/nubkins/jerry/jerry-happy.png'),
    neutral: require('../../assets/nubkins/jerry/jerry-neutral.png'),
    sad:     require('../../assets/nubkins/jerry/jerry-sad.png'),
    excited: require('../../assets/nubkins/jerry/jerry-excited.png'),
  },
  'skin-starry': {
    happy:   require('../../assets/nubkins/starry/starry-happy.png'),
    neutral: require('../../assets/nubkins/starry/starry-neutral.png'),
    sad:     require('../../assets/nubkins/starry/starry-sad.png'),
    excited: require('../../assets/nubkins/starry/starry-excited.png'),
  },
  'skin-babynubs': {
    happy:   require('../../assets/nubkins/nubs/babynubs-happy.png'),
    neutral: require('../../assets/nubkins/nubs/babynubs-neutral.png'),
    sad:     require('../../assets/nubkins/nubs/babynubs-sad.png'),
    excited: require('../../assets/nubkins/nubs/babynubs-happy.png'),
  },
};

const DEFAULT = SKIN_IMAGES['skin-default'];

export function getSkinImages(skinId: string): SkinMoodImages {
  return SKIN_IMAGES[skinId] ?? DEFAULT;
}

// The questionnaire's three steps: names, icons, tones, and why each one matters (the rail's tip).
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import Code from '@mui/icons-material/Code'
import PersonOutlined from '@mui/icons-material/PersonOutlined'
import type { Tone } from './design/tokens'

export const STEPS: { title: string; short: string; icon: typeof Code; tone: Tone; tip: string }[] = [
  {
    title: 'About you',
    short: 'About',
    icon: PersonOutlined,
    tone: 'indigo',
    tip: 'Your country and years of work choose who you are compared with for pay: people in the same role and experience band, as close to you as the data allows.',
  },
  {
    title: 'Technologies',
    short: 'Tech',
    icon: Code,
    tone: 'violet',
    tip: 'Choose what you used for extensive work, not everything you have tried. Ticking nearly a whole list reads as a careless answer, as it did in the survey.',
  },
  {
    title: 'AI usage',
    short: 'AI',
    icon: AutoAwesome,
    tone: 'cyan',
    tip: 'Curious what an answer is worth? After your results, change it here and get recommendations again: SkillPath shows what moved.',
  },
]

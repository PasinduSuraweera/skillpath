// Example profiles for the "Try an example" buttons (demo and manual testing).
// Every value comes from GET /api/options; each one was checked against the API.
import type { Profile } from './api/types'

export interface Sample {
  id: string
  name: string
  summary: string
  profile: Profile
}

const BACHELORS = 'Bachelor’s degree (B.A., B.S., B.Eng., etc.)'
const LEARNED_AI_FOR_CAREER = 'Yes, I learned how to use AI-enabled tools required for my job or to benefit my career'

export const SAMPLES: Sample[] = [
  {
    id: 'undergrad',
    name: 'Sri Lankan CS undergrad',
    summary: 'Final-year student; Java, Python and JavaScript; React and Spring Boot projects; no job yet.',
    profile: {
      country: 'Sri Lanka',
      years_code: 4,
      work_exp: 0,
      ed_level: 'Some college/university study without earning a degree',
      learn_code_ai: 'Yes, I learned how to use AI-enabled tools for my personal curiosity and/or hobbies',
      tech: {
        Language: { have: ['Java', 'Python', 'JavaScript', 'HTML/CSS', 'SQL'], want: ['TypeScript', 'Go'] },
        Database: { have: ['MySQL', 'MongoDB'], want: ['PostgreSQL'] },
        Platform: { have: ['npm', 'Pip'], want: ['Docker', 'Amazon Web Services (AWS)'] },
        Webframe: { have: ['React', 'Node.js', 'Express', 'Spring Boot'], want: ['Next.js'] },
        DevEnvs: { have: ['Visual Studio Code', 'IntelliJ IDEA'], want: [] },
        AIModels: { have: ['openAI GPT (chatbot models)', 'Gemini (Flash general purpose models)'], want: [] },
      },
      ai: { AISelect: 'Yes, I use AI tools daily', AIAgents: 'No, but I plan to', AIAcc: 'Somewhat trust', AISent: 'Favorable' },
    },
  },
  {
    id: 'data',
    name: 'Data / ML-leaning graduate',
    summary: 'MSc, 2 years at work; Python, SQL and R in Jupyter; no web development.',
    profile: {
      country: 'Sri Lanka',
      years_code: 6,
      work_exp: 2,
      ed_level: 'Master’s degree (M.A., M.S., M.Eng., MBA, etc.)',
      learn_code_ai: LEARNED_AI_FOR_CAREER,
      tech: {
        Language: { have: ['Python', 'SQL', 'R'], want: ['Scala'] },
        Database: { have: ['PostgreSQL', 'SQLite'], want: ['BigQuery'] },
        Platform: { have: ['Pip', 'Google Cloud'], want: ['Docker'] },
        Webframe: { none: true },
        DevEnvs: { have: ['Jupyter Notebook/JupyterLab', 'Visual Studio Code', 'PyCharm'], want: [] },
        AIModels: { have: ['openAI GPT (chatbot models)', 'Meta Llama (all models)'], want: [] },
      },
      ai: {
        AISelect: 'Yes, I use AI tools weekly',
        AIAgents: 'No, I use AI exclusively in copilot/autocomplete mode',
        AIAcc: 'Neither trust nor distrust',
        AISent: 'Favorable',
      },
    },
  },
  {
    id: 'mobile',
    name: 'Mobile developer',
    summary: '3 years building Android apps with Kotlin, Java and Firebase in India.',
    profile: {
      country: 'India',
      years_code: 6,
      work_exp: 3,
      ed_level: BACHELORS,
      learn_code_ai: LEARNED_AI_FOR_CAREER,
      tech: {
        Language: { have: ['Kotlin', 'Java', 'TypeScript', 'JavaScript'], want: ['Swift'] },
        Database: { have: ['SQLite', 'Firebase Realtime Database'], want: [] },
        Platform: { have: ['Firebase', 'npm'], want: ['Docker'] },
        Webframe: { have: ['React', 'Node.js'], want: [] },
        DevEnvs: { have: ['Android Studio', 'Visual Studio Code'], want: [] },
        AIModels: { have: ['Anthropic: Claude Sonnet'], want: [] },
      },
      ai: {
        AISelect: 'Yes, I use AI tools daily',
        AIAgents: 'Yes, I use AI agents at work weekly',
        AIAcc: 'Somewhat trust',
        AISent: 'Favorable',
      },
    },
  },
  {
    id: 'switcher',
    name: 'Career switcher',
    summary: 'New to coding (1 year), only Python, relies heavily on AI assistants. Few answers, so expect a broad result.',
    profile: {
      country: 'United Kingdom of Great Britain and Northern Ireland',
      years_code: 1,
      work_exp: 0,
      ed_level: BACHELORS,
      learn_code_ai: LEARNED_AI_FOR_CAREER,
      tech: {
        Language: { have: ['Python'], want: ['JavaScript'] },
        AIModels: { have: ['openAI GPT (chatbot models)', 'Anthropic: Claude Sonnet'], want: [] },
      },
      ai: {
        AISelect: 'Yes, I use AI tools daily',
        AIAgents: 'Yes, I use AI agents at work daily',
        AIAcc: 'Somewhat trust',
        AISent: 'Very favorable',
      },
    },
  },
]

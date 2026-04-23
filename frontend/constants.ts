import { Startup, Rarity } from './types';


// Data matches backend server.js
export const MOCK_STARTUPS: Startup[] = [
  { id: '1', name: 'OpenAI', batch: 'Private', description: 'Best Model: GPT 5.4', value: 157000, change: 45, logo: 'https://picsum.photos/40/40?random=1', coverImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=500&fit=crop', stage: 'Series F', score: 100, trend: [100000, 120000, 130000, 140000, 150000, 157000] },
  { id: '2', name: 'Anthropic', batch: 'Private', description: 'Best Model: Claude Opus 4.7', value: 183000, change: 30, logo: 'https://picsum.photos/40/40?random=2', coverImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=500&fit=crop', stage: 'Series F', score: 99, trend: [120000, 135000, 150000, 165000, 175000, 183000] },
  { id: '3', name: 'Google DeepMind', batch: 'Private', description: 'AlphaGo and Gemini creators.', value: 250000, change: 20, logo: 'https://picsum.photos/40/40?random=3', coverImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=500&fit=crop', stage: 'Acquired', score: 98, trend: [200000, 210000, 220000, 230000, 240000, 250000] },
  { id: '4', name: 'xAI', batch: 'Private', description: 'Best Model: Grok 4', value: 50000, change: 50, logo: 'https://picsum.photos/40/40?random=4', coverImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=500&fit=crop', stage: 'Series B', score: 95, trend: [20000, 28000, 35000, 40000, 45000, 50000] },
  { id: '5', name: 'Midjourney', batch: 'Private', description: 'AI image generation.', value: 6000, change: 35, logo: 'https://picsum.photos/40/40?random=5', coverImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=500&fit=crop', stage: 'Series B', score: 92, trend: [3000, 3800, 4500, 5200, 5600, 6000] },
  { id: '6', name: 'Meta AI', batch: 'Private', description: 'Best Model: Llama 4', value: 3000, change: 40, logo: 'https://picsum.photos/40/40?random=6', coverImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=500&fit=crop', stage: 'Series B', score: 88, trend: [1500, 1900, 2300, 2600, 2800, 3000] },
  { id: '7', name: 'Alibaba', batch: 'Private', description: 'Best Model: Qwen 3.6 Plus', value: 29300, change: 25, logo: 'https://picsum.photos/40/40?random=7', coverImage: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=500&fit=crop', stage: 'Series D', score: 90, trend: [20000, 22000, 24000, 26000, 28000, 29300] },
  { id: '8', name: 'Z AI', batch: 'Private', description: 'Best Model: GLM 5.1', value: 10000, change: 15, logo: 'https://picsum.photos/40/40?random=8', coverImage: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400&h=500&fit=crop', stage: 'Bootstrapped', score: 85, trend: [7000, 7800, 8500, 9200, 9600, 10000] },
  { id: '9', name: 'Cursor', batch: 'Private', description: 'AI Code Editor', value: 1500, change: 22, logo: 'https://picsum.photos/40/40?random=9', coverImage: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&h=500&fit=crop', stage: 'Series D', score: 82, trend: [1000, 1150, 1250, 1350, 1450, 1500] },
  { id: '10', name: 'Deepseek', batch: 'Private', description: 'Best Model: Deepseek R1', value: 1100, change: 28, logo: 'https://picsum.photos/40/40?random=10', coverImage: 'https://images.unsplash.com/photo-1589903308904-1010c2294adc?w=400&h=500&fit=crop', stage: 'Series B', score: 80, trend: [700, 800, 900, 1000, 1050, 1100] },
  { id: '11', name: 'Windsurf', batch: 'Private', description: 'AI Code Editor.', value: 4500, change: 18, logo: 'https://picsum.photos/40/40?random=11', coverImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=500&fit=crop', stage: 'Series D', score: 84, trend: [3000, 3500, 3900, 4200, 4350, 4500] },
  { id: '12', name: 'Antigravity', batch: 'Private', description: 'AI Code Editor', value: 350, change: 12, logo: 'https://picsum.photos/40/40?random=12', coverImage: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=400&h=500&fit=crop', stage: 'Series B', score: 75, trend: [250, 280, 300, 320, 335, 350] },
  { id: '13', name: 'MiniMax', batch: 'Private', description: 'Best Model: MiniMax M2.7', value: 1000, change: 8, logo: 'https://picsum.photos/40/40?random=13', coverImage: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=400&h=500&fit=crop', stage: 'Series A', score: 78, trend: [800, 850, 900, 950, 980, 1000] },
  { id: '14', name: 'Mistral AI', batch: 'Private', description: 'Best Model: Mistral Large 3', value: 1000, change: 10, logo: 'https://picsum.photos/40/40?random=14', coverImage: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=400&h=500&fit=crop', stage: 'Series A', score: 70, trend: [700, 780, 850, 920, 960, 1000] },
  { id: '15', name: 'Kiro', batch: 'Private', description: 'AI Code Editor', value: 1500, change: 5, logo: 'https://picsum.photos/40/40?random=15', coverImage: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=500&fit=crop', stage: 'Series A', score: 68, trend: [1200, 1280, 1350, 1420, 1460, 1500] },
  { id: '16', name: 'Perplexity', batch: 'Private', description: 'AI-powered answer engine.', value: 150, change: 8, logo: 'https://picsum.photos/40/40?random=16', coverImage: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&h=500&fit=crop', stage: 'Series A', score: 65, trend: [100, 115, 125, 135, 143, 150] },
  { id: '17', name: 'Cohere', batch: 'Private', description: 'Best Model: Command a.', value: 1000, change: 12, logo: 'https://picsum.photos/40/40?random=17', coverImage: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&h=500&fit=crop', stage: 'Series C', score: 72, trend: [700, 780, 850, 920, 960, 1000] },
  { id: '18', name: 'Moonshot AI', batch: 'Private', description: 'Best Model: Kimi 2.5', value: 500, change: 15, logo: 'https://picsum.photos/40/40?random=18', coverImage: 'https://images.unsplash.com/photo-1589903308904-1010c2294adc?w=400&h=500&fit=crop', stage: 'Series C', score: 74, trend: [350, 390, 430, 470, 485, 500] },
  { id: '19', name: 'Sarvam AI', batch: 'Private', description: 'Best Model: Sarvam 105B', value: 150, change: 6, logo: 'https://picsum.photos/40/40?random=19', coverImage: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=400&h=500&fit=crop', stage: 'Series B', score: 66, trend: [120, 128, 135, 142, 146, 150] },
];

// Rarity colors for display
export const RARITY_COLORS: Record<Rarity, { bg: string; text: string; border: string }> = {
  [Rarity.COMMON]: { bg: 'bg-gray-800', text: 'text-gray-300', border: 'border-gray-600' },
  [Rarity.RARE]: { bg: 'bg-green-600', text: 'text-white', border: 'border-green-500' },
  [Rarity.EPIC]: { bg: 'bg-orange-600', text: 'text-white', border: 'border-orange-500' },
  [Rarity.EPIC_RARE]: { bg: 'bg-orange-600', text: 'text-white', border: 'border-orange-500' },
  [Rarity.LEGENDARY]: { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-400' },
};

// Rarity multipliers
export const RARITY_MULTIPLIERS: Record<Rarity, number> = {
  [Rarity.COMMON]: 1,
  [Rarity.RARE]: 3,
  [Rarity.EPIC]: 5,
  [Rarity.EPIC_RARE]: 8,
  [Rarity.LEGENDARY]: 10,
};
# Meridian - Geospatial Market Intelligence Platform

Meridian is a geospatial market intelligence platform that provides real-time visualization of global data on an interactive 3D globe. Built with Next.js 15, CesiumJS, and shadcn/ui.

## Features (Phase 1)

- **3D Globe Visualization** - Interactive CesiumJS globe with Google Photorealistic 3D Tiles
- **Real-time Flight Tracking** - ADS-B aircraft data from OpenSky Network API
- **Entity Inspection Panel** - Sidebar for viewing detailed aircraft information
- **Time Display** - Current UTC time and data freshness indicator
- **Responsive Design** - Modern UI with Tailwind CSS and shadcn/ui components

## Tech Stack

- **Framework**: Next.js 15 with TypeScript
- **3D Globe**: CesiumJS with Google Photorealistic 3D Tiles
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix primitives)
- **State Management**: Zustand
- **Data Source**: OpenSky Network API (ADS-B flight data)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun
- A Cesium Ion account (free tier available)

### Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd meridian
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your Cesium Ion token:
   ```bash
   cp .env.local.example .env.local
   ```

4. Get your free Cesium Ion token:
   - Visit [https://cesium.com/ion/tokens](https://cesium.com/ion/tokens)
   - Create a free account if needed
   - Copy your default access token
   - Paste it in your `.env.local` file

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_CESIUM_ION_TOKEN` | Cesium Ion access token for 3D Tiles | Yes |

## Deployment

### Deploy to Vercel

The easiest way to deploy Meridian is using [Vercel](https://vercel.com):

1. Push your code to GitHub

2. Import your repository in Vercel:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Select your repository
   - Vercel will auto-detect Next.js settings

3. Add your environment variable:
   - In the Vercel dashboard, go to Settings → Environment Variables
   - Add `NEXT_PUBLIC_CESIUM_ION_TOKEN` with your Cesium Ion token

4. Deploy!

### Using Vercel CLI

Alternatively, deploy from the command line:

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy
vercel
```

## Project Structure

```
meridian/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Main page
│   ├── layout.tsx         # Root layout
│   └── api/aircraft/      # Aircraft API route
├── components/            # React components
│   ├── globe/            # CesiumJS globe component
│   ├── header/           # Header and status bar
│   ├── sidebar/          # Entity inspection panel
│   └── ui/               # shadcn/ui components
├── lib/                   # Utilities and services
│   ├── cesium.ts         # CesiumJS configuration
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API services
│   ├── stores/           # Zustand stores
│   └── types/            # TypeScript types
└── public/               # Static assets
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Future Phases

See [plans/meridian-implementation-plan.md](plans/meridian-implementation-plan.md) for the full roadmap including:
- Phase 2: Maritime & Vessel Tracking
- Phase 3: Market Data Integration
- Phase 4: Analytics & Alerting
- Phase 5: Enterprise Features

## License

MIT

## Acknowledgments

- [CesiumJS](https://cesium.com/) - 3D geospatial visualization
- [OpenSky Network](https://opensky-network.org/) - ADS-B flight data
- [shadcn/ui](https://ui.shadcn.com/) - UI components

# ED2-Final-Project-Group-7: Spatiotemporal Hotspots in Transportation Networks

## Project Overview

This project aims to improve road safety in Florida by leveraging data analytics to identify accident hotspots. The system processes and visualizes historical accident data from a Supabase database onto an interactive map using OpenLayers. The goal is to provide actionable insights for policymakers, traffic managers, and drivers, ultimately contributing to safer roads through data-driven decision-making.

This is a [Next.js](https://nextjs.org) project built with React, Tailwind CSS, and integrates with Supabase for data management and OpenLayers for map visualization.

## Features

- Fetches accident data from a Supabase backend.
- Visualizes accident data on an interactive map using OpenLayers.
- Identifies and highlights potential accident hotspots (implementation details TBD).
- User-friendly web interface built with Next.js and Tailwind CSS.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org) 15+
- **UI Library:** [React](https://reactjs.org) 19+
- **Styling:** [Tailwind CSS](https://tailwindcss.com)
- **Database:** [Supabase](https://supabase.io)
- **Mapping:** [OpenLayers](https://openlayers.org)
- **Animation:** [Framer Motion](https://www.framer.com/motion/)
- **Geometry Parsing:** [Wellknown](https://github.com/mapbox/wellknown)

## Getting Started

Follow these instructions to set up the project locally for development and testing.

### Prerequisites

- [Node.js](https://nodejs.org/) (Version 18.x or later recommended)
- [npm](https://www.npmjs.com/), [yarn](https://yarnpkg.com/), or [pnpm](https://pnpm.io/) package manager
- Access to the project's Supabase instance (URL and anon key)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd ED2-Final-Project-Group-7
    ```

2.  **Install dependencies:**
    Choose your preferred package manager:

    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    ```

3.  **Set up environment variables:**
    Create a file named `.env.local` in the root of the project directory. Add your Supabase credentials to this file:
    ```plaintext
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    ```
    Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with your actual Supabase project URL and anon key.

### Running the Development Server

Once the installation is complete and environment variables are set, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

This command starts the Next.js development server (using Turbopack for speed) on `http://localhost:3000`. Open this URL in your web browser to see the application. The page will auto-update as you make changes to the code.

## Available Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Creates a production-ready build of the application.
- `npm run start`: Starts the production server (requires a build first).
- `npm run lint`: Runs the ESLint linter to check for code style issues.

## Deployment

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

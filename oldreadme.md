# ED2-Final-Project-Group-7

```
Spatiotemporal Hotspots in Transportation Networks

project aims to improve road safety in Florida by leveraging data analytics to identify accident hotspots.
The system will process and visualize historical accident data to provide actionable insights for
policymakers, traffic managers, and drivers.
The result is a user-friendly web platform that supports data-driven decision-making for safer roads.
```

## stack

    - react js or ts
    - tailwind
    - firebase authentication / firestore / storage

## packages

    - firebase
    - tailwind

## packages install

### init project

### setting firebase keys

```
put in .env fire firebase keys
set in main.tsx and export [ auth, db, storage ] from there
```

#### setup tailwind[https://tailwindcss.com/docs/guides/vite]

    npx tailwindcss init -p

    tailwind.config.js
    ...
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ]

    index.css
    @tailwind base;
    @tailwind components;
    @tailwind utilities;

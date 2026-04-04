/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#2563EB",
          green: "#22C55E",
          red: "#EF4444",
          ink: "#0F172A",
          mist: "#E2E8F0",
          cloud: "#F8FAFC",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
      },
      boxShadow: {
        glow: "0 24px 80px rgba(37, 99, 235, 0.18)",
        soft: "0 20px 55px rgba(15, 23, 42, 0.09)",
      },
      animation: {
        "pulse-slow": "pulse 2.4s ease-in-out infinite",
        float: "float 8s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        "mesh-glow":
          "radial-gradient(circle at top left, rgba(37,99,235,0.22), transparent 42%), radial-gradient(circle at 85% 12%, rgba(34,197,94,0.18), transparent 30%), radial-gradient(circle at bottom right, rgba(239,68,68,0.16), transparent 36%)",
      },
    },
  },
  plugins: [],
};

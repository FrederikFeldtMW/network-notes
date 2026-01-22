export const colors = {
  background: "#F7F6F2",
  surface: "#FFFFFF",
  text: "#1C1C1E",
  muted: "#8E8E93",
  divider: "#E5E5EA",
  accent: "#0A84FF",
  accentSoft: "#EAF2FF",
  success: "#2ECC71",
  warning: "#F5A623",
  danger: "#FF4D4F",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const radii = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
};

export const shadows = {
  floating: {
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
};

export const typography = {
  title: { fontSize: 28, fontWeight: "700" as const },
  subtitle: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  caption: { fontSize: 13, fontWeight: "500" as const },
};
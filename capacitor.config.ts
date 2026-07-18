import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.citylogger.app",
  appName: "CityLogger",
  webDir: "dist-mobile",
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile"
  }
};

export default config;

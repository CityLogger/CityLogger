import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.citylogger.app",
  appName: "CityLog",
  webDir: "dist-mobile",
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile"
  }
};

export default config;

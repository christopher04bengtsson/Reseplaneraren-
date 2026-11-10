import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// WebGL (Three.js) needs a GPU-capable GL backend when rendering headless.
// "angle" works on most machines; switch to "swangle" on servers without a GPU.
Config.setChromiumOpenGlRenderer("angle");

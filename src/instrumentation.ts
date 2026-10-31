export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerAutomations } = await import("./lib/automation");
    registerAutomations();
  }
}

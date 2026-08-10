const placeholderPattern = /^(your_|.*_here$|\.{3})/i;

export function requiredEnv(name) {
  const value = process.env[name];

  if (!value || placeholderPattern.test(value)) {
    console.error(`${name} is missing or still has the placeholder value in .env`);
    process.exit(1);
  }

  return value;
}

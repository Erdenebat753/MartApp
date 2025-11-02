module.exports = {
  apps: [
    {
      name: "nest",
      script: "npm",
      args: "run start:dev",
      cwd: "./Nest_Server",
      env: {
        NODE_ENV: "development",
        INTENT_API_URL: "http://localhost:5001",
        PORT: 5000,
      },
    },
    {
      name: "intent",
      script: "uvicorn",
      args: "main:app --port 5001 --reload",
      cwd: "./FastApi_AI",
      interpreter: "python3",
      env: {
        PYTHONPATH: ".",
      },
    },
  ],
};

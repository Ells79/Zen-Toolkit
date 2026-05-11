export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: { message: "Method not allowed" },
    });
  }

  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).json({
      error: { message: "Missing Authorization header" },
    });
  }

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    res.status(response.status);
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/json; charset=utf-8");
    return res.send(text);
  } catch (error) {
    return res.status(500).json({
      error: {
        message: String(error?.message || error),
      },
    });
  }
}

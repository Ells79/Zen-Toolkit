export default async function handler(req, res) {
if (req.method !== "POST") {
return res.status(405).json({
error: { message: "Method not allowed" },
});
}

try {
const response = await fetch(
"https://api.deepseek.com/chat/completions",
{
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: req.headers.authorization,
},
body: JSON.stringify(req.body),
}
);

```
const data = await response.json();

res.status(response.status).json(data);
```

} catch (error) {
res.status(500).json({
error: {
message: String(error.message || error),
},
});
}
}

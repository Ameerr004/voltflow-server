// Role gate — mirrors the reference store-server pattern.
// The client sends the logged-in user's role in the "x-role" header.
export default function adminAuth(req, res, next) {
  const role = req.headers["x-role"];
  // or send a request to the database using the email to get the role
  if (role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Admin access only" });
  }
}

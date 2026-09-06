import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  // Support both cookie-based auth and Authorization header for flexibility
  let token;
  if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token missing or invalid' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('CRITICAL: JWT_SECRET is missing');
      return res.status(500).json({ success: false, message: 'Internal server configuration error' });
    }

    const decoded = jwt.verify(token, secret);
    req.user = decoded; // { userId, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

export function authorizeRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, message: 'Access denied: role not verified' });
    }

    const roleHierarchy = {
      'INSPECTOR': 1,
      'ADMIN': 2
    };

    const userRoleLevel = roleHierarchy[req.user.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 100;

    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({ success: false, message: 'Access denied: insufficient privileges' });
    }

    next();
  };
}

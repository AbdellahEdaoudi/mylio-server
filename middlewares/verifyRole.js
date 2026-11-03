const verifyRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req?.user?.role) {
            return res.status(403).json({
                message: "No role found"
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: "Insufficient permissions"
            });
        }
        next();
    }
}

module.exports = { verifyRole };
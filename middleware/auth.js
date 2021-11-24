const jwt = require('jsonwebtoken');

exports.authCheck = (req, res, next) => {
    try {
        if (!req.headers.token) {
            return res.status(401).send('Not Authorized');
        }

        const { userId } = jwt.verify(req.headers.token, process.env.JWT_SECRET);

        req.userId = userId;
        next();
    } catch (error) {
        console.error(error);
        return res.status(401).send('Not Authorized');
    }
}
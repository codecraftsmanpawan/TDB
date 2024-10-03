const Jwt = require('jsonwebtoken');
require('dotenv').config();


async function checkLogin(req, res, next) {
  try {
    const token = req.header('Authorization');
    

    if (!token) {
      return res.status(401).json({
        message: 'Not Logged In'
      });
    }

    const tokenWithoutBearer = token.replace('Bearer ', '');

    try {
      const decoded = Jwt.verify(tokenWithoutBearer, process.env.SECRET_KEY);
      // console.log(decoded)
      // req.user = decoded;
    
      req.user = { _id: decoded.id }; 
      
      next();
    } catch (jwtError) {
      console.error(jwtError);

      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          message: 'Token has expired'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          message: 'Invalid token'
        });
      }

      

      return res.status(401).json({
        message: 'Invalid token'
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'There was an error while interacting with the database'
    });
  }
}

module.exports = checkLogin;

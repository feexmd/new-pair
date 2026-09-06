// id.js
function makeid(num = 4) {
  let result = "";
  let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var characters9 = characters.length;
  for (var i = 0; i < num; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters9));
  }
  return result;
}

// Generate unique session ID
function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `FEE_${timestamp}_${random}`;
}

module.exports = { makeid, generateSessionId };
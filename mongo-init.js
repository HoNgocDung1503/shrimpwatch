db = db.getSiblingDB('shrimpwatch');

// Xoa user cu neu co (de tranh loi user da ton tai neu chay lai nhieu lan)
try { db.dropUser('shrimp_app'); print("Dropped old shrimp_app user"); } catch(e) { print("Old user not exist, skip drop: " + e.message); }

// Tao user moi voi QUYEN DBOWNER (du quyen cho tat ca hoat dong hackathon)
db.createUser({
  user: 'shrimp_app',
  pwd: 'shrimp_pass',
  roles: [
    { role: 'dbOwner', db: 'shrimpwatch' },
    { role: 'readAnyDatabase', db: 'admin' }
  ]
});
print('Created shrimp_app user with dbOwner role on shrimpwatch DB');

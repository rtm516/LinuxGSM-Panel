var express = require('express');
var session = require('express-session');
var helmet = require('helmet');
var sqlite3 = require('sqlite3');
var SQLiteStore = require('connect-sqlite3')(session);
var fs = require('fs');
var errors = require("./errors.js");
var bodyParser = require('body-parser');
var TimeUnit = require('timeunit');

var config = {};

if (!fs.existsSync("./configs")){
	fs.mkdirSync("./configs");
}

if (!fs.existsSync("./logs")){
	fs.mkdirSync("./logs");
}

function log(message, noprefix, noprint) {
	var date = new Date();
	var prefix = "[" + ('0' + date.getDate()).slice(-2) + "/" + ('0' + date.getMonth()).slice(-2) + "/" + date.getFullYear() + " " + ('0' + date.getHours()).slice(-2) + ":" + ('0' + date.getMinutes()).slice(-2) + ":" + ('0' + date.getSeconds()).slice(-2) + "] ";
	var fullMessage = message;
	if (!noprefix){
		fullMessage = prefix + message;
	}
	if (!noprint){
		console.log(fullMessage);
	}
	fs.appendFile("./logs/" + ('0' + date.getDate()).slice(-2) + "-" + ('0' + date.getMonth()).slice(-2) + "-" + date.getFullYear() + ".txt", fullMessage + "\n");
}

log("\n\n\n\n", true, true);

log("Loading config file");
if (fs.existsSync('./configs/config.json')) {
	try {
		config = JSON.parse(fs.readFileSync('./configs/config.json', 'utf8'));
		log("Loaded config file");
	}catch (e) {
		log("Failed to load config")
	}
}else{
	log("No config found!")
}

log("Checking config for correct values")
var hasMissing = false;
if (!("port" in config)) {
	log("Server port key missing from config");
	hasMissing = true;
	config.port = 3000;
}
if (!("logins" in config)) {
	log("Logins list missing from config");
	hasMissing = true;
	config.logins = [{user:"admin",pass:"password", admin: 1}];
}

function saveConfig() {
	log("Saving config");
	fs.writeFileSync('./configs/config.json', JSON.stringify(config, null, "\t"));
}

if (hasMissing === true) {
	log("Closing, please correct config");
	saveConfig();
	process.exit();
}

//Create a new express app
var app = express();

//Use helmet for security
app.use(helmet());

//Check if servers db already exists
var serversExists = fs.existsSync("./configs/servers.db");

//Create ServersDB
var ServersDB = new sqlite3.Database("./configs/servers.db");

//Do initial setup of servers db 
ServersDB.serialize(function() {
	//Check to make sure the db is setup when its created
	if (!serversExists) {
		//ServersDB.run("CREATE TABLE `tblServers` (`id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, `uniqueID` TEXT NOT NULL UNIQUE;");
	}
});

//Allow for post requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
})); 

//Tell express to use ejs
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

//Define the check auth function
function checkAuth(req, res, next) {
  if (!req.session.user) {
	errors.throw(403, req, res, "", log, "");
  } else {
    next();
  }
}

//Define the check auth function for admins
function checkAuthAdmin(req, res, next) {
	if (!req.session.user) {
		errors.throw(403, req, res, "", log, "");
	} else if (req.session.user.admin && req.session.user.admin == 1) {
		next();
	} else {
		errors.throw(403, req, res, "", log, "");
	}
}

//Setup cookies and login
app.use(session({
	secret: '55bda0972742833913e226bfdc92d398',
	name: 'loginPersist',
	resave: true,
	saveUninitialized: true,
	store: new SQLiteStore({dir: "./configs", db: "sessions.db"}),
	cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } //1 Week
}));



app.get('/', function(req, res){
	if (req.session.user) {
		res.redirect("/servers");
	}else{
		res.render('index', { user: req.session.user, page: "index" });
	}
});

app.get('/servers', checkAuth, function(req, res){
	/*BookingsDB.all("SELECT id, name, capacity FROM tblRooms ORDER BY name ASC", function(err, rows) {
		if (err) {
			errors.throw(500, req, res, err.toString().replace("Error: ", ""), log);
		}else{
			res.render('rooms', { user: req.session.user, page: "rooms", rooms: rows });
		}
	});*/
	res.render('servers', { user: req.session.user, page: "servers" });
});

app.get('/about', checkAuth, function(req, res){
	res.render('about', { user: req.session.user, page: "about" });
});

app.post('/ajax/login', function(req, res){
	var username = req.body.user;
	var password = req.body.pass;
	
	var checkU = config.logins.find(x => x.user === username);
	if (checkU && checkU.user == username && checkU.pass == password) {
		req.session.user = {};
		req.session.user.id = username;
		req.session.user.admin = checkU.admin;
		res.json({success:1,error:''});
	}else{
		res.json({success:0,error:'Wrong username or password'});
	}
});

app.get('/logout', function (req, res) {
	delete req.session.user;
	res.redirect('/');
});



//Allows for a static folder
app.use(express.static('static'));

//Start the server
log("Running webserver on *:" + config.port);
app.listen(config.port);

//Error handling
app.use(function (req, res) {
	errors.throw(404, req, res, "", log);
});
app.use(function (err, req, res, next) {
	var errorNo = (err.status || 500);
	errors.throw(errorNo, req, res, err.message, log);
});

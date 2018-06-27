var express = require("express")
var bodyParser = require("body-parser");
var routes = require("./routes/routes.js");
var cors = require ('cors')
var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors())

routes(app);

var server = app.listen(5555, function () {
    console.log("Zendesk Portal API running on port", server.address().port);
});
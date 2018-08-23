var axios = require("axios")
var CircularJSON = require('circular-json')
var config = require ('../config.js')

var appRouter = function (app) {

    app.get('/tickets/:type-:query', function (req, res) {

        let type = req.params.type;
        let query = req.params.query;
        let url = config.ZendeskAPI() + '/search.json?query=' + query;
        
        if (type === 'refresh') {
            getPagination(url)
            .then (result => parseRefreshTickets(result))
            .then (resolved_result => res.status(200).send(resolved_result))
            .catch (error => res.status(500).send(error))
        }
        if (type === 'dq') {
            getPagination(url)
            .then (result => parseTickets(result))
            .then (resolved_result => res.status(200).send(resolved_result))
            .catch (error => res.status(500).send(error))
        }
        if (type === 'all') {
            getPagination(url)
            .then (result => parseTickets(result))
            .then (resolved_result => res.status(200).send(resolved_result))
            .catch (error => res.status(500).send(error))
        }
    });

    app.get('/getHCOInfo/:org', function (req, res) {

        let org = req.params.org
        let url = config.ZendeskAPI() + '/search.json?query=type:organization%20name:"' + org + '"'

        let request_params ={
            method: 'GET',
            url: url,
            headers: {
                'Authorization': 'Basic '+ config.ZendeskAPI_Key(),
                'Content-Type':  'application/json'
            }
        }

        axios(request_params)
        .then(function(response){
            let response_json = response.data.results;
            res.status(200).send(response_json)
        })
        .catch(function() {
            res.status(500).send("Error")
        });
    })

    app.get('/getTicketComments/:id', function (req, res) {

        let ticketid = req.params.id;

        let request_params ={
            method: 'GET',
            url: config.ZendeskAPI() + '/tickets/' + ticketid + '/comments.json',
            headers: {
                'Authorization': 'Basic ' + config.ZendeskAPI_Key(),
                'Content-Type':  'application/json'
            }
        }

        axios(request_params)
        .then(function(response){
            let response_json = CircularJSON.stringify(response.data.comments);
            let promise = parseTicketComments(response_json);
            promise.then(function(result) {
                response_resolved = result
                res.status(200).send(response_resolved)
            });
        })
        .catch(function (){
            res.status(500).send("Error")
        });
        
    });

    app.get('/orgs/:type', function (req, res) {
        let type = req.params.type

        let query = (type === 'hco') ? '/search.json?query=type:organization tags:hco' : '/search.json?query=type:organization'
        let url = config.ZendeskAPI() + query

        let request_params ={
            method: 'GET',
            url: url,
            headers: {
                'Authorization': 'Basic '+ config.ZendeskAPI_Key(),
                'Content-Type':  'application/json'
            }
        }

        axios(request_params)
        .then(function(response){
            let response_json = response.data;
            res.status(200).send(response_json)
        })
        .catch(function() {
            res.status(500).send("Error")
        });
    });

    app.get('/users', function (req, res) {

        let org = req.params.org

        let url = config.ZendeskAPI() + '/search.json?query=type:user tags:refresh_admin tags:refresh_cc tags:admin'

        getPagination(url)
        .then (result => res.status(200).send(result))
        .catch (error => res.status(500).send(error))

    });

    
    function getPagination  (url, TicketPages = []) {
        return new Promise(resolve => {
            let request_params ={
                method: 'GET',
                url: url,
                headers: {
                    'Authorization': 'Basic ' + config.ZendeskAPI_Key(),
                    'Content-Type':  'application/json'
                }
            }

            axios(request_params)
            .then(function(response){
                let response_json = CircularJSON.stringify(response.data.results)
                TicketPages = TicketPages.concat(JSON.parse(response_json))
                let url = response.data.next_page
                if (url != null){
                    resolve(getPagination(url, TicketPages))
                }
                else{
                    resolve(TicketPages)
                }
                })
                .catch(function (){
                    resolve ("Error getting tickets")
                });

        });
    }

    async function parseTickets(data) {
        try{    
            json = data
            let json_resolved = []

            lookupDictionary = await getLookupDictionary(json)

            for (i = 0; i < json.length; i ++) { 
                id = json[i]["id"]
                subject = json[i]["subject"]
                status = json[i]["status"]  
                created_at_unformatted = new Date(json[i]["created_at"])
                created_at = created_at_unformatted.toLocaleDateString("en-US")
                requester_email =  lookupDictionary[json[i]["requester_id"]]
                organization_name =  lookupDictionary[json[i]["organization_id"]]


                if (requester_email == null){
                    requester_email = "Error finding requester email"
                }

                if (organization_name == null){
                    organization_name = "Error finding organization name"
                }
                

                json_resolved.push({id, subject, requester_email, organization_name, status, created_at})
            }

            return(JSON.stringify(json_resolved))

        }catch (e){
            return e
        }
        
    }

    async function parseRefreshTickets(data) {
        try{    
            json = data
            let json_resolved = []

            lookupDictionary = await getLookupDictionary(json)

            for (i = 0; i < json.length; i ++) { 
                id = json[i]["id"]
                subject = json[i]["subject"]  
                requester_email =  lookupDictionary[json[i]["requester_id"]]
                organization_name =  lookupDictionary[json[i]["organization_id"]]
                created_at_unformatted = new Date(json[i]["created_at"])
                patient_count = json[i]["fields"][5]["value"]
                status = json[i]["fields"][3]['value']  
                
                if (status === "refresh_successful") {
                    status = "Successful";
                } else if (status === "refresh_postponed") {
                    status = "Postponed";
                } else if (status === "refresh_cancelled") {
                    status = "Cancelled"
                }
                if (json[i]["fields"][4]["value"] != null){
                    refresh_date_unformatted = new Date(json[i]["fields"][4]["value"])
                } else {
                    refresh_date_unformatted = null
                }

                if (json[i]["fields"][4]["value"] != null){
                    refresh_date_unformatted = new Date(json[i]["fields"][4]["value"])
                } else {
                    refresh_date_unformatted = null
                }

                if (requester_email == null){
                    requester_email = "Error finding requester email"
                }

                if (organization_name == null){
                    organization_name = "Error finding organization name"
                }

                if (patient_count == null){
                    patient_count = ""
                } else{
                    patient_count = parseFloat(patient_count).toLocaleString('en')
                }

                if (refresh_date_unformatted == null){
                    refresh_date = ""
                }else{
                    var options = {}
                    options.timeZone = "UTC"
                    refresh_date = refresh_date_unformatted.toLocaleDateString("en-US", options)
                }

                if (created_at_unformatted == null){
                    created_at = ""
                }else{
                    var options = {}
                    options.timeZone = "UTC"
                    created_at = created_at_unformatted.toLocaleDateString("en-US", options)
                }

                json_resolved.push({id, subject, requester_email, organization_name, refresh_date, patient_count, created_at, status})
            }

            return(JSON.stringify(json_resolved))

        }catch (e){
            return e
        }
        
    }

     function getLookupDictionary (data){

        return new Promise(resolve => {

            json = data
            ticket_ids = []

            for (i = 0; i < json.length; i ++) {
                ticket_ids.push(json[i]["id"])
            }

            var promise = getUsersOrgs(ticket_ids)

            promise
            .then(function (result){
                resolve(result)
            })

        
        });
    }

    function getUsersOrgs(tickets){
        return new Promise(resolve => {
            try{
                ticket_ids = tickets
                lookup_ticketids = []
                promises = []
                lookupDictionary = new Object()


                for (i=0; i < ticket_ids.length; i++){
                    lookup_ticketids.push(ticket_ids[i])

                    if ((i%100)==0 & i!=0){
                        promises.push(resolveUsersOrgs(config.ZendeskAPI() + '/tickets/show_many.json?ids=' + lookup_ticketids + '&include=users,organizations'))
                        lookup_ticketids = []
                    }
                }

                promises.push(resolveUsersOrgs(config.ZendeskAPI() + '/tickets/show_many.json?ids=' + lookup_ticketids + '&include=users,organizations'))

                
                Promise.all(promises)
                .then (function(result) {
                    for (i=0; i< result.length; i++){
                        temp_dictionary = result[i]
                            for (var key in temp_dictionary){
                                lookupDictionary[key]=temp_dictionary[key]
                            }
                    }
                    resolve(lookupDictionary)
                })
                .catch(function (){
                    resolve ("Error resolving user and org IDs")
                });
            }catch (e){
                return e
            }
        });

    }

    function resolveUsersOrgs (url){
       return new Promise(resolve => {

            let lookupDictionary = new Object()

            let request_params ={
                method: 'GET',
                url: url,
                headers: {
                    'Authorization': 'Basic ' + config.ZendeskAPI_Key(),
                    'Content-Type':  'application/json'
                }
            }


            axios(request_params)
            .then(function(response) {
                let response_json_users = response.data.users
                let response_json_orgs = response.data.organizations
                
                for (i=0; i < response_json_orgs.length; i++){
                   lookupDictionary[response_json_orgs[i]["id"]] = response_json_orgs[i]["name"]
                }
               
                for (i=0; i < response_json_users.length; i++){
                    lookupDictionary[response_json_users[i]["id"]] = response_json_users[i]["email"]
                }
                resolve(lookupDictionary)
                })
                .catch(function (){
                    resolve ("Error resolving user and org IDs")
                });

        });

    }

    async function parseTicketComments(data) {
        try{
            json = JSON.parse(data)
            let json_resolved = []
            let i, id, public, body, created_at

            for (i = 0; i < json.length; i++) { 
                author_email = ""
                id = json[i]["author_id"]
                public = json[i]["public"].toString()
                body = json[i]["body"]
                created_at_unformatted =  new Date(json[i]["created_at"])

                if (created_at_unformatted == null){
                    created_at = ""
                }else{
                    var options = {hour: "2-digit", minute: "2-digit"}
                    options.timeZone = "America/New_York"
                    created_at = created_at_unformatted.toLocaleDateString("en-US", options)
                }
        
                author_email = await resolveUserID(id)
                    
                json_resolved.push({author_email, public, body, created_at})
                }
        
            return(JSON.stringify(json_resolved))
            }catch (e){
                return e
            }
    }

    function resolveUserID(id) {
        return new Promise(resolve => {
                let request_params = {
                    method: 'GET',
                    url: config.ZendeskAPI() + '/users/' + id + '.json',
                    headers: {
                        'Authorization': 'Basic ' + config.ZendeskAPI_Key(),
                        'Content-Type':  'application/json'
                    }
                }

                axios(request_params)
                .then(function(response){
                    resolve(response.data.user.email)
                })
                .catch(function (){
                    resolve("Error resolving user email")
                })
        });
    }

}
  
module.exports = appRouter;
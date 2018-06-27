var axios = require("axios")
var CircularJSON = require('circular-json')
var config = require ('../config.js')

var appRouter = function (app) {

    app.get('/getDQTickets', function (req, res) {
 
        let url = config.ZendeskAPI() + '/search.json?query=tags:dataquality_dataissue'
        
        getTicketsPagination(url)
        .then (result => parseDQTicketsOverview(result))
        .then (resolved_result => res.status(200).send(resolved_result))
        .catch (error => res.status(500).send(error))

    });


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

    
    function getTicketsPagination  (url, TicketPages = []) {
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
                    resolve(getTicketsPagination(url, TicketPages))
                }
                else{
                    resolve(TicketPages)
                }
                })
                .catch(function (){
                    resolve ("Error getting DQ Tickets")
                });

        });
    }

    async function parseDQTicketsOverview(data) {
        try{    
            json = data
            let json_resolved = []

            lookupDictionary = await getLookupDictionary(json)

            for (i = 0; i < json.length; i ++) { 
                id = json[i]["id"]
                subject = json[i]["subject"]
                status = json[i]["status"]    
                requester_email =  lookupDictionary[json[i]["requester_id"]]
                organization_name =  lookupDictionary[json[i]["organization_id"]]
                json_resolved.push({id, subject, requester_email, organization_name, status})
            }

            return(JSON.stringify(json_resolved))

        }catch (e){
            return e
        }
        
    }

    function getLookupDictionary (data){

        return new Promise(resolve => {

            json = data
            let promises = []
            let ids = []
            let lookupDictionary = new Object()

            for (i = 0; i < json.length; i ++) { 
                ids.push (json[i]["requester_id"])
                ids.push (json[i]["organization_id"])
                promises.push (resolveUserID(json[i]["requester_id"]))
                promises.push (resolveOrgID(json[i]["organization_id"]))
            }

            Promise.all(promises)
            .then (function(result) {
                for (j=0; j < result.length; j++){
                    key = ids[j]
                    lookupDictionary[key] = result[j]
                }
            })
            .then(function (){
                resolve(lookupDictionary)
            })
            .catch(function (){
                resolve ("Error getting DQ Tickets")
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
                created_at = json[i]["created_at"]
        
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

    function resolveOrgID(id){
        return new Promise(resolve => {
                let request_params = {
                    method: 'GET',
                    url: config.ZendeskAPI() + '/organizations/' + id + '.json',
                    headers: {
                         'Authorization': 'Basic ' + config.ZendeskAPI_Key(),
                        'Content-Type':  'application/json'
                    }
                }
    
                axios(request_params)
                .then(function(response){
                     resolve(response.data.organization.name)
                })
                .catch(function (){
                    resolve("Error resolving Org Name")
                })
        });
    }


}
  
module.exports = appRouter;
var express = require('express');
var bodyParser = require('body-parser')
var app = express();
var rp = require('request-promise');
var fs = require('fs-extra');
var isMoreThanOneIng = false;

var errorResponse = {
    "fulfillmentText": "This is an error",
    "fulfillmentMessages": [],
    "source": "sti2.com",
    "payload": {
        "google": {
            "expectUserResponse": true,
            "richResponse": {
                "items": [{
                    "simpleResponse": {
                        "textToSpeech": "ERROR!"
                    }
                }]
            }
        },
        "facebook": {
            "text": "ERROR!"
        },
        "slack": {
            "text": "ERROR!"
        }
    },
    "outputContexts": [],
    "followupEventInput": {}
}

function constructQuery(params, offset) {
    //need to be replaced {difficulty, duration, ingredient}

    var newQuery = fs.readFileSync('./query', 'utf8');
    if (params.ingredient.length != 0) {

        var filterMulti = "";
        for (var i = 0; i < params.ingredient.length; i++) {
            filterMulti = filterMulti + "'" + params.ingredient[i].toString().toLowerCase() + "'";
            filterMulti = filterMulti + " && ";
        }
        filterMulti = filterMulti.slice(0, filterMulti.length - 4);
        newQuery = newQuery.replace(/#{ing}/g, '')
            .replace(/{ingSlot}/g, filterMulti)

    }
    if (params.recipeName) {
        newQuery = newQuery.replace(/#{name}/g, '').replace(/{nameSlot}/g, params.recipeName.toString().toLowerCase()).replace('limit 5', 'limit 1')

    }

    if (params.duration) {
        var durationMin = 60;
        if (params.duration.unit == 'stunde') {
            durationMin = params.duration.amount * 60;
        } else {
            durationMin = params.duration.amount;
        }
        newQuery = newQuery.replace(/#{time}/g, '').replace(/{timeSlot}/g, durationMin);
        //replace with params.duration.amount
    }
    if (params.difficulty) {
        if (params.difficulty == "einfach")
            newQuery = newQuery.replace(/#{diff}/g, '').replace(/{diffSign}/g, '<=');
        else
            newQuery = newQuery.replace(/#{diff}/g, '').replace(/{diffSign}/g, '>');
    }
    newQuery = newQuery.replace('{offset}', offset);
    //console.log(newQuery);
    return newQuery;

}
app.use(bodyParser.urlencoded({
    extended: false
}))

app.use(bodyParser.json())

app.listen(3000, function() {
    console.log('Example app listening on port 3000!');
});

app.post('/alles', function(req, res) {

    var sessionId = req.body.session;
    //offset is irrelevant for the query at the moment
    if (req.body.queryResult.intent.displayName == "mainIntent") {
        var offset = 0;
        var params = req.body.queryResult.parameters;
        if (req.outputContexts) offset = req.outputContexts[0].parameters.offset;
        var options = {
            method: 'POST',
            uri: 'http://graphdb.sti2.at:8080/repositories/broker-graph',
            form: {
                query: constructQuery(params, offset)
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/sparql-results+json,*/*;q=0.9'
            }
        };
        return rp(options).then(function(body) {
                var bodyJSON = JSON.parse(body);
                var triadRecipe = {};
                var recipeNameList = [];
                for (var key in bodyJSON.results.bindings) {
                    var binding = bodyJSON.results.bindings[key];
                    var recipeName = binding.name.value;
                    //since recipeYield is optional it might not appear check it
                    if (binding.recYield) var recipeYield = binding.recYield.value;
                    else var recipeYield = "";
                    if (binding.recImage) var recipeImage = binding.recImage.value;
                    else var recipeImage = "";
                    var recipeInst = binding.recipe.value;
                    var recipeIngr = binding.ingredients.value;
                    if (triadRecipe[recipeName]) {
                        triadRecipe[recipeName].ingredients.push(recipeIngr);
                    } else {
                        triadRecipe[recipeName] = {
                            recYield: recipeYield,
                            instruction: recipeInst,
                            recImage: "https:" + recipeImage,
                            ingredients: []
                        };
                        triadRecipe[recipeName].ingredients.push(recipeIngr);
                        recipeNameList.push(recipeName);
                    }
                }
                if (bodyJSON.results.bindings.length == 0) {
                    var responseText = "Leider konnte ich kein Rezept finden. Bitte suchen Sie noch einmal anders.";
                    var response = {
                        "fulfillmentText": responseText,
                        "fulfillmentMessages": [],
                        "source": "sti2.com",
                        "payload": {
                            "google": {
                                "expectUserResponse": true,
                                "richResponse": {
                                    "items": [{
                                        "simpleResponse": {
                                            "textToSpeech": responseText,
                                        }
                                    }]
                                }
                            },
                            "facebook": {
                                "text": responseText
                            },
                            "slack": {
                                "text": responseText
                            }
                        },
                        "outputContexts": [],
                        "followupEventInput": {}
                    }
                    res.send(JSON.stringify(response));
                } else {
                    var responseText = "Ich habe die beliebtesten " + recipeNameList.length + " Rezepte gefunden. Die bleibteste ist " + recipeNameList[0] + ". Möchten Sie weitere Informationen erhalten?";
                    var response = {
                        "fulfillmentText": responseText,
                        "fulfillmentMessages": [],
                        "source": "sti2.com",
                        "payload": {
                            "google": {
                                "expectUserResponse": true,
                                "richResponse": {
                                    "items": [{
                                        "simpleResponse": {
                                            "textToSpeech": responseText,
                                        }
                                    }]
                                }
                            },
                            "facebook": {
                                "text": responseText
                            },
                            "slack": {
                                "text": responseText
                            }
                        },
                        "outputContexts": [{
                            "name": sessionId + "/contexts/generic",
                            "lifespanCount": 6,
                            "parameters": {
                                "offset": offset,
                                "triadRecipe": triadRecipe,
                                "recipeNameList": recipeNameList
                            }
                        }],
                        "followupEventInput": {}
                    }

                    res.send(JSON.stringify(
                        response
                    ));
                }
            })
            .catch(function(err) {
                console.log(err);

                res.send(JSON.stringify(
                    errorResponse
                ));
            })
    } else if (req.body.queryResult.intent.displayName == "mainIntent - yes") {
        var sessionData = req.body.queryResult.outputContexts;
        var params = {};
        for (var contextKey in sessionData) {

            if (sessionData[contextKey].name == sessionId + "/contexts/generic") {
                var params = sessionData[contextKey].parameters
                break;
            }
        }
        if (params) {
            var theRecipe = params.triadRecipe[params.recipeNameList[params.offset]];
            var responseText = "Ich habe die notwendigen Informationen an Sie gesendet. Wenn Sie es nicht mögen, können Sie zum nächsten Rezept gehen, indem Sie weiter sagen, oder Sie können sagen: Ich möchte eine neue Suche machen.";
            var cardText = "Zutaten: " + theRecipe.ingredients.join() + " \n  Zubereitung: " + theRecipe.instruction + " \n Menge: " + theRecipe.recYield;
            var response = {
                "fulfillmentText": responseText,
                "fulfillmentMessages": [{
                    "card": {
                        "title": params.recipeNameList[params.offset],
                        "subtitle": cardText,
                        "imageUri": theRecipe.recImage
                    }
                }],
                "source": "sti2.com",
                "payload": {
                    "google": {
                        "expectUserResponse": true,
                        "richResponse": {
                            "items": [{
                                "simpleResponse": {
                                    "textToSpeech": responseText,
                                }
                            }, {
                                "basicCard": {
                                    "title": params.recipeNameList[params.offset],
                                    "formattedText": cardText,
                                    "image": {
                                        "url": theRecipe.recImage,
                                        "accessibilityText": "Irgendein Bild"
                                    },
                                    "buttons": [],
                                    "imageDisplayOptions": "CROPPED"
                                }
                            }]
                        }
                    },
                    "facebook": {
                        "text": responseText
                    },
                    "slack": {
                        "text": responseText
                    }
                },
                "outputContexts": [{
                    "name": sessionId + "/contexts/generic",
                    "lifespanCount": 6,
                    "parameters": {
                        "offset": params.offset + 1,
                        "triadRecipe": params.triadRecipe,
                        "recipeNameList": params.recipeNameList
                    }
                }],
                "followupEventInput": {}
            }
            res.send(JSON.stringify(response));
        } else {
            //if the guy just said yes to nothing
            res.send(JSON.stringify(
                errorResponse));
        }

    } else if (req.body.queryResult.intent.displayName == "mainIntent - yes - next") {
        var sessionData = req.body.queryResult.outputContexts;
        var params = {};
        for (var contextKey in sessionData) {
            if (sessionData[contextKey].name == sessionId + "/contexts/generic") {
                var params = sessionData[contextKey].parameters
                break;
            }
        }
        if (params) {
            //check if recipe exists
            if (params.triadRecipe[params.recipeNameList[params.offset]]) {
                var theRecipe = params.triadRecipe[params.recipeNameList[params.offset]];
                var responseText = "Das nächste beliebte Rezept heißt " + params.recipeNameList[params.offset] + ". Ich habe die Informationen an Sie gesendet. Nächste oder neue Suche?"
                var cardText = "Zutaten: " + theRecipe.ingredients.join() + " \n  Zubereitung: " + theRecipe.instruction + " \n Menge: " + theRecipe.recYield;
                var response = {
                    "fulfillmentText": responseText,
                    "fulfillmentMessages": [{
                        "card": {
                            "title": params.recipeNameList[params.offset],
                            "subtitle": cardText,
                            "imageUri": theRecipe.recImage
                        }
                    }],
                    "source": "sti2.com",
                    "payload": {
                        "google": {
                            "expectUserResponse": true,
                            "richResponse": {
                                "items": [{
                                    "simpleResponse": {
                                        "textToSpeech": responseText,
                                    }
                                }, {
                                    "basicCard": {
                                        "title": params.recipeNameList[params.offset],
                                        "formattedText": cardText,
                                        "image": {
                                            "url": theRecipe.recImage,
                                            "accessibilityText": "Irgendein Bild"
                                        },
                                        "buttons": [],
                                        "imageDisplayOptions": "CROPPED"
                                    }
                                }]
                            }
                        },
                        "facebook": {
                            "text": responseText
                        },
                        "slack": {
                            "text": responseText
                        }
                    },
                    "outputContexts": [{
                        "name": sessionId + "/contexts/generic",
                        "lifespanCount": 6,
                        "parameters": {
                            "offset": params.offset + 1,
                            "triadRecipe": params.triadRecipe,
                            "recipeNameList": params.recipeNameList
                        }
                    }],
                    "followupEventInput": {}
                }
                res.send(JSON.stringify(response));
            } else {
                var responseText = "Es scheint, als ob du nicht gefunden hast, wonach du suchst. Bitte machen Sie eine neue Suche.";
                var response = {
                    "fulfillmentText": responseText,
                    "fulfillmentMessages": [],
                    "source": "sti2.com",
                    "payload": {
                        "google": {
                            "expectUserResponse": true,
                            "richResponse": {
                                "items": [{
                                    "simpleResponse": {
                                        "textToSpeech": responseText,
                                    }
                                }]
                            }
                        },
                        "facebook": {
                            "text": responseText
                        },
                        "slack": {
                            "text": responseText
                        }
                    },
                    "outputContexts": [],
                    "followupEventInput": {}
                }
                res.send(JSON.stringify(response));
            }
        } else {
            //if the guy just said next to nothing
            res.send(JSON.stringify(errorResponse));
        }

    }
});

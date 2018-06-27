# dflow_Rezept
Dialogflow fullfilment webhook
The code is mainly based on SPARQL queries executed on the knowledge graph. The contents of the knowledge graph come from the annotations on ichkoche.at website. The agent is implemented in German. 

From scratch:
- Open an account in dialogflow. If you want to try on your mobile phones or google home devices, use the same e-mail address you are connected in.
- Import the Rezepte.zip file, check how to import from https://miningbusinessdata.com/how-to-import-an-agent-zip-file-into-api-ai/
- Go to integrations and choose google assistant to use it on your phone (the webhook is implemented for only google assistant so far) and check the welcome intent to tell the agent as the startpoint. (you can add additional intents for merged invocation, example; mit Rezept Meister sprechen wie kann ich Lasagne kochen)
- You will be redirected to google actions webpage. You can change invocation name from Test App to whatever you like. Make sure that at least one action is built. 
- Try it out in the console. It may not immediately work. Check actions, other setting, also the permissions you allow.
- Once it worked on the console actions, then you can try on your phone. It is set to Deutschland - Deutsch. You may need to change the language settings on your phone if it is Osterreich - Deutsch.
- Enjoy the agent! You can re-implement however you like.

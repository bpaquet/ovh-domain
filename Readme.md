ovh-domain
===

Command line tool to view and edit OVH Domain zone through [api](api.ovh.com).

Installation
---

    npm install -g node-ovh-domain

Configuration
---

* Create an [application](https://eu.api.ovh.com/createApp/).
* Configure ovh-domain

    ovh-domain configure <app_key> <app_secret>

You have to validate the generated consumer key with the returned URL. Be careful with the validity duration !

You can specify the endpoint on configure command

    ovh-domain configure <app_key> <app_secret> ovh-ca

More details can be found [here](https://api.ovh.com/g934.first_step_with_api) and [here](https://github.com/ovh/node-ovh).

Usage
---

You can get the full list of commands

    ovh-domain list

Some examples :

* get zones list : ``ovh-domain zones``
* view a zone : ``ovh-domain show toto.com``
* create a record: ``ovh-domain create toto.com r1 CNAME www.google.com.``
* delete a record: ``ovh-domain delete toto.com r1``
* update a record: ``ovh-domain create toto.com r1 www.yahoo.com.``

ovh-domain
===

Command line tool to view and edit OVH Domain zone through [api](api.ovh.com).

Installation
---

    npm install -g node-ovh-domain

Configuration
---

Create an [application](https://eu.api.ovh.com/createApp/).

    export APP_KEY=your_app_key
    export APP_SECRET=your_app_secret

If needed

    export ENDPOINT=ovh-ca

Create a consumer key

    ovh-domain consumer-key

Validate your consumer key with the returned url, and

    export CONSUMER_KEY=consumer_key

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

# <img src="https://dapps.earth/icon300.png" alt="drawing" width="32" valign="middle"/> dapps.earth: secure IPFS and Swarm gateway
Server deployment details: [Integrity logs](https://dapps.earth/integrity/), [Travis credentials](https://dapps.earth/travis-credentials/)

Source code: [https://github.com/burdakovd/dapps.earth](https://github.com/burdakovd/dapps.earth) [![Build Status](https://travis-ci.com/burdakovd/dapps.earth.svg?branch=master)](https://travis-ci.com/burdakovd/dapps.earth)

## What?

This is a gateway into [IPFS](https://ipfs.io/) and [Swarm](https://swarm-guide.readthedocs.io/en/latest/introduction.html). If you already have IPFS/Swarm software installed locally, you may not need a gateway, but many people do not have it, and for them this website provides access.

It is designed to provide safe access to [ÐApps](https://github.com/ethereum/wiki/wiki/Decentralized-apps-(dapps)) to general public, who may not have installed special software to access decentralized networks.

Currently only ÐApps from the planet Earth are supported (hence the gateway name).

## Why? What's wrong with existing gateways?

There are existing gateways to IPFS and Swarm, notably [gateway.ipfs.io](https://gateway.ipfs.io/) and [swarm-gateways.net](https://swarm-gateways.net/), however, they aren't providing access in a secure way, so I wouldn't advise to use ÐApps through such gateways, as I'll explain in a moment.

Furthermore, due to the same reasons, even http gateway on localhost (as a lot of people use) is not secure, unless you take special precautions.

Web security has evolved over many years, and is a result of work of various standartization commitees, web browser developers, and website developers.

One important concept in Web security model is **origin**. It roughly corresponds to a domain name. Browser mostly assume that objects from the same origin _trust_ each other, while different origins _do not trust_ each other. I.e. microsoft.com is not supposed to access or modify your data at google.com, whereas google.com/maps is allowed to access data from google.com

Mainstream IPFS/Swarm gateways serve _all_ of the content from a single _origin_, i.e. `gateway.ipfs.io` or `swarm-gateways.net`, therefore throwing away all _origin_-based security model that Web community have been building over the years.

IPFS and Swarm have some internal concept of websites, but browsers have no way to know about those, so they just assume the whole gateway is just a giant website with millions of pages, and they let all of the pages interact with each other without any restriction. Arbitrary page can read/modify other pages' cookies, local storage, and even install service worker that will forever be able to intercept all requests to that gateway and respond with any content it wishes (we [dodged the bullet](https://github.com/ipfs/go-ipfs/issues/4025) with service worker due to pure luck)

**dapps.earth** avoids this problem by serving each individual IPFS content ID or Swarm manifest from a separate domain. That way traditional web security still applies. There are nuances around subdomains (browser allow them to share some data with each other), but we are in the process of adding root domains to [Public Suffix List](https://en.wikipedia.org/wiki/Public_Suffix_List) so that browsers know that `a.ipfs.dapps.earth` has no relation to `b.ipfs.dapps.earth`, despite them being subdomains of the same domain.

## Is it that serious? Give me example!

If you are still not convinced of security risks of traditional gateways, here is a demo.

Consider the following two pages:
 - [https://gateway.ipfs.io/ipns/ipfs.io/](https://gateway.ipfs.io/ipns/ipfs.io/)
 - [https://swarm-gateways.net/bzz:/theswarm.eth/](https://swarm-gateways.net/bzz:/theswarm.eth/)

These two links are using official gateways and are pointing to home pages of IPFS and Swarm correspondingly.

Now let us make some _tricky_ versions of those links:
 - [https://gateway.ipfs.io/ipns/ipfs.io/](https://bit.ly/dapps-earth-demo-01)
 - [https://swarm-gateways.net/bzz:/theswarm.eth/](https://bit.ly/dapps-earth-demo-02)

They look the same as the original links. After you open them, you see the same address in your address bar. If you had bookmarked the original two pages, you'd see your bookmark highlight to indicate that you are on familiar page. However the content is completely different :)

Such thing wouldn't have been possible if different content was served from different subdomains.

# <img src="https://dapps.earth/icon300.png" alt="drawing" width="32" valign="middle"/> dapps.earth: subdomain-based IPFS and Swarm gateway

Source code: [https://github.com/burdakovd/dapps.earth](https://github.com/burdakovd/dapps.earth) [![Build Status](https://api.travis-ci.com/burdakovd/dapps.earth.svg?branch=master)](https://travis-ci.com/burdakovd/dapps.earth)

Deployment transparency: [audit server integrity](https://dapps.earth/audit.html), [view server logs](https://dapps.earth/integrity/), [CI credentials](https://dapps.earth/travis-credentials/)

## What?

This is a gateway into [IPFS](https://ipfs.io/) and [Swarm](https://swarm-guide.readthedocs.io/en/latest/introduction.html). If you already have IPFS/Swarm software installed locally, you may not need a gateway, but many people do not have it, and for them this website provides access.

It is designed to provide safe access to [ÐApps](https://github.com/ethereum/wiki/wiki/Decentralized-apps-(dapps)) to general public, who may not have installed special software to access decentralized networks.

Currently only ÐApps from the planet Earth are supported (hence the gateway name).

## Why? What's wrong with existing gateways?

There are existing gateways to IPFS and Swarm, notably [ipfs.io](https://ipfs.io/) and [swarm-gateways.net](https://swarm-gateways.net/), however, they aren't providing access in a secure way, so I wouldn't advise to use ÐApps through such gateways, as I'll explain in a moment.

Furthermore, due to the same reasons, even http gateway on localhost (as a lot of people use) is not secure, unless you take special precautions.

Web security has evolved over many years, and is a result of work of various standardization committees, web browser developers, and website developers.

One important concept in Web security model is **origin**. It roughly corresponds to a domain name. Browser mostly assume that objects from the same origin _trust_ each other, while different origins _do not trust_ each other. I.e. microsoft.com is not supposed to access or modify your data at google.com, whereas google.com/maps is allowed to access data from google.com

Mainstream IPFS/Swarm gateways serve _all_ of the content from a single _origin_, i.e. `ipfs.io` or `swarm-gateways.net`, therefore throwing away all _origin_-based security model that Web community have been building over the years.

IPFS and Swarm have some internal concept of websites, but browsers have no way to know about those, so they just assume the whole gateway is just a giant website with millions of pages, and they let all of the pages interact with each other without any restriction. Arbitrary page can read/modify other pages' cookies, local storage, and even install service worker that will forever be able to intercept all requests to that gateway and respond with any content it wishes (we [dodged the bullet](https://github.com/ipfs/go-ipfs/issues/4025) with service worker due to pure luck)

**dapps.earth** avoids this problem by serving each individual IPFS content ID or Swarm manifest from a separate domain. That way traditional web security still applies. There are nuances around subdomains (browser allow them to share some data with each other), but we are [in the process](https://github.com/publicsuffix/list/pull/708) of adding root domains to [Public Suffix List](https://en.wikipedia.org/wiki/Public_Suffix_List) so that browsers know that `a.ipfs.dapps.earth` has no relation to `b.ipfs.dapps.earth`, despite them being subdomains of the same domain.

## Is it that serious? Give me example!

If you are still not convinced of security risks of traditional gateways, here is a demo.

Consider the following two pages:
 - [https://ipfs.io/ipns/ipfs.io/](https://ipfs.io/ipns/ipfs.io/)
 - [https://swarm-gateways.net/bzz:/theswarm.eth/](https://swarm-gateways.net/bzz:/theswarm.eth/)

These two links are using official gateways and are pointing to home pages of IPFS and Swarm correspondingly.

Now let us make some _tricky_ versions of those links:
 - [https://ipfs.io/ipns/ipfs.io/](https://bit.ly/dapps-earth-demo-01)
 - [https://swarm-gateways.net/bzz:/theswarm.eth/](https://bit.ly/dapps-earth-demo-02)

They look the same as the original links. After you open them, you see the same address in your address bar. If you had bookmarked the original two pages, you'd see your bookmark highlight to indicate that you are on familiar page. However the content is completely different :)

Such thing wouldn't have been possible if different content was served from different subdomains.

## OK, how do I use it?
We use base32 encoding for subdomains, as this is the sweet spot in set of characters vs length of the hash. For example characters in base58/base64 are case-sensitive, making them not suitable for domain names, whereas base16 produces hashes of 64 characters, which is just one character longer than maximum allowed subdomain name length (63).

### IPFS
We support base32-encoded CIDv1 as subdomain, for example: [https://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq.ipfs.dapps.earth/](https://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq.ipfs.dapps.earth/)

For convenience, we also perform redirect to subdomain if resource is accessed traditional way, for example: [https://ipfs.dapps.earth/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/](https://ipfs.dapps.earth/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/)

Note the difference in the hash. It is because of base32 vs base58 encoding, and also because of difference in CIDv0 and CIDv1. If in doubt, use traditional addressing and it will redirect you to the correct subdomain.

### Swarm
We support three protocols: `bzz`, `bzz-hash`, `bzz-immutable`.

`bzz` allows querying mutable content using ENS, for example: [https://theswarm.eth.bzz.dapps.earth](https://theswarm.eth.bzz.dapps.earth)

`bzz-hash` allows querying hash of mutable content using ENS, for example: [https://theswarm.eth.bzz-hash.dapps.earth](https://theswarm.eth.bzz-hash.dapps.earth)

`bzz-immutable` allows querying immutable content directly using hash, for example [https://h4cpab3mz443iehtiipfi5vj46pnytrspvm5peu2u2wz7rz7m4vq.bzz-immutable.dapps.earth/](https://h4cpab3mz443iehtiipfi5vj46pnytrspvm5peu2u2wz7rz7m4vq.bzz-immutable.dapps.earth/) - note that this currently is broken due to [ethersphere/go-ethereum/issues/912](https://github.com/ethersphere/go-ethereum/issues/912)

For convenience, we also perform redirect to subdomain if resource is accessed the traditional way, for example:

- [https://bzz.dapps.earth/bzz:/theswarm.eth/](https://bzz.dapps.earth/bzz:/theswarm.eth/)
- [https://bzz.dapps.earth/bzz-hash:/theswarm.eth/](https://bzz.dapps.earth/bzz-hash:/theswarm.eth/)
- [https://bzz.dapps.earth/bzz-immutable:/3f04f0076ccf39b410f3421e5476a9e79edc4e327d59d7929aa6ad9fc73f672b](https://bzz.dapps.earth/bzz-immutable:/3f04f0076ccf39b410f3421e5476a9e79edc4e327d59d7929aa6ad9fc73f672b)

Note the difference in the hash. It is because of base32 vs base16 encoding.

## What is not supported / Limitations

 - IPNS is not supported. IPNS resources are not that useful for ÐApps due to mutability. IPNS websites can also use TXT record to direct their traffic to `ipfs.io` in a safe way. Also, since they can have domains of arbitrary depth, it will be a pain for me to obtain all the necessary SSL certificates.
 - Writing is not supported. The gateway is read-only. Writing is for power users, and can be done using local software or traditional gateways.
 - ENS are supported only one level and only in `.eth` zone. The reasoning is that it is an extra hassle to obtain SSL certificates for each subdomain, e.g. I can't get certificate for `*.*.bzz.dapps.earth`, only one wildcard is allowed.

## Why should I trust you?

Speaking of security, why would I want to access ÐApps musing a gateway operated by random person? They can manipulate all the data transmitted, and basically do MITM.

This is a great question!

In the future, browser could detect IPFS (not talking about Swarm here as it is much younger) content automatically, and check hash of whatever the server returned to avoid MITM attacks.

This is not done yet, so for now you have to trust the gateway is operating honestly. However, you don't have to trust me. The code is open-sourced, and the deployment procedure is carefully designed in a way that allows you to verify that it is running the code from Github and nothing else.

See [audit page](https://dapps.earth/audit.html) to verify in a trustless fashion that EC2 instance that powers this website has been launched in tamperproof way. Please review the audit procedure carefully. Once the instance is launched, it pulls updates from `release` branch of the Github repository and does not allow manual modifications. All updates are also logged and are available in the [server logs](https://dapps.earth/integrity/).

As an example of failed audit you can see [audit page for test version of the website](https://dapps.earth/audit.html#staging.dapps.earth/) - it will fail audit in many aspects.

It is also possible to run audit procedure using CLI, it runs as part of our [CI](https://travis-ci.com/burdakovd/dapps.earth).

There is also a prebuilt Docker image that makes audit a single command: `docker run dappsearth/audit dapps.earth`.

## Can I run a clone?

Of course. For local run, simple `. ~/.env.local && docker-compose build && docker-compose up -d` may work,
though you'd need to make sure all the necessary ports are open, and DNS is configured correctly.

Technically, you can run it even on localhost, if you point your DNS to 127.0.0.1.

It will require a bit of careful port-forwarding though to ensure DNS requests from public can reach your server (it is needed to automatically obtain SSL certificate).

To deploy on AWS, see `scripts` directory.

## Alternatives

To my knowledge, there are two websites on the Internet providing similar functionality.

`eth.show` for Swarm, e.g. [http://theswarm.eth.show/](http://theswarm.eth.show/)

`ipfs.dweb.link` for IPFS, e.g. [http://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq.ipfs.dweb.link/](http://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq.ipfs.dweb.link/)

Neither of them supports HTTPS encryption though at the time of writing.

## Contributions

Issues and pull requests are welcome at [https://github.com/burdakovd/dapps.earth](https://github.com/burdakovd/dapps.earth)

Please do carefully review audit procedure, as we want to make sure it is well-defined and if there are issues, we'd want to find them sooner. The more people review it now - the better.

Donations are accepted at [0x93864E077B53d68BFd09DE1A63CAeDCBb24595F2](https://etherscan.io/address/0x93864E077B53d68BFd09DE1A63CAeDCBb24595F2) in ETH, or at [3PHDhyeF3VmQ3k3enmBSkbZrSXhztHU4yH](https://www.blockchain.com/btc/address/3PHDhyeF3VmQ3k3enmBSkbZrSXhztHU4yH) in BTC.

## Acceptable Use Policy and abuse reports

It is not allowed to abuse the website for any illegal, harmful, fraudulent, infringing or offensive use, or to download or view content that is illegal, harmful, fraudulent or offensive.

Prohibited activities or content include:
-   **Illegal, Harmful or Fraudulent Activities.**  Any activities that are illegal, that violate the rights of others, or that may be harmful to others, our operations or reputation, including disseminating, promoting or facilitating child pornography, offering or disseminating fraudulent goods, services, schemes, or promotions, make-money-fast schemes, ponzi and pyramid schemes, phishing, or pharming.
-   **Infringing Content.**  Content that infringes or misappropriates the intellectual property or proprietary rights of others.
-   **Offensive Content.**  Content that is defamatory, obscene, abusive, invasive of privacy, or otherwise objectionable, including content that constitutes child pornography, relates to bestiality, or depicts non-consensual sex acts.
-   **Harmful Content**. Content or other computer technology that may damage, interfere with, surreptitiously intercept, or expropriate any system, program, or data, including viruses, Trojan horses, worms, time bombs, or cancelbots.

If you find illegal content on the website, please report it via a Github issue at [https://github.com/burdakovd/dapps.earth/issues](https://github.com/burdakovd/dapps.earth/issues). See [dapps.earth/issues/9](https://github.com/burdakovd/dapps.earth/issues/9) and [dapps.earth/pull/10](https://github.com/burdakovd/dapps.earth/pull/10) for an example.

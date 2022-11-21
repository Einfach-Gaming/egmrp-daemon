# [3.0.0](https://github.com/Einfach-Gaming/egmrp-daemon/compare/v2.2.3...v3.0.0) (2022-11-21)


### Bug Fixes

* remove @types/yup ([ed0cb4d](https://github.com/Einfach-Gaming/egmrp-daemon/commit/ed0cb4d22819133dc226d35aac6278193bd962cf))


### Features

* upgrade all dependencies and migrate to ESM ([0b26705](https://github.com/Einfach-Gaming/egmrp-daemon/commit/0b267055eba67bfc7f72ed197ff108fd76a32605))


### BREAKING CHANGES

* The minimum required Node.js version is now 18
* The daemon is now distributed as ES Module
* Renamed index to main

# [3.0.0](https://github.com/Einfach-Gaming/egmrp-daemon/compare/v2.2.3...v3.0.0) (2022-11-21)


### Features

* upgrade all dependencies and migrate to ESM ([0b26705](https://github.com/Einfach-Gaming/egmrp-daemon/commit/0b267055eba67bfc7f72ed197ff108fd76a32605))


### BREAKING CHANGES

* The minimum required Node.js version is now 18
* The daemon is now distributed as ES Module
* Renamed index to main

# [3.0.0](https://github.com/Einfach-Gaming/egmrp-daemon/compare/v2.2.3...v3.0.0) (2022-11-21)


### Features

* upgrade all dependencies and migrate to ESM ([0b26705](https://github.com/Einfach-Gaming/egmrp-daemon/commit/0b267055eba67bfc7f72ed197ff108fd76a32605))


### BREAKING CHANGES

* The minimum required Node.js version is now 18
* The daemon is now distributed as ES Module
* Renamed index to main
* The whitelist is no longer set using a json file, but with the WHITELIST env variable (see README)

## [2.2.3](https://github.com/Einfach-Gaming/egmrp-daemon/compare/v2.2.2...v2.2.3) (2021-05-19)


### Bug Fixes

* **deps:** update dependency pino to v6.11.3 ([#43](https://github.com/Einfach-Gaming/egmrp-daemon/issues/43)) ([8978ae1](https://github.com/Einfach-Gaming/egmrp-daemon/commit/8978ae1e1742220d121359083fb529f8b0c3242a))

## [2.2.2](https://github.com/Einfach-Gaming/egmrp-daemon/compare/v2.2.1...v2.2.2) (2021-04-22)


### Bug Fixes

* Dont crash Daemon when Sender or is not initalized yet ([61bd19a](https://github.com/Einfach-Gaming/egmrp-daemon/commit/61bd19a91b8ce96123468eb19dd1772d3b9ad6dd))

## [2.2.1](https://github.com/Einfach-Gaming/egmrp-daemon/compare/v2.2.0...v2.2.1) (2021-04-08)


### Bug Fixes

* use github container registry ([327d6fc](https://github.com/Einfach-Gaming/egmrp-daemon/commit/327d6fc23e259cc34d1c87ccc63e9c249e72b671))

# [2.2.0](https://github.com/Einfach-Gaming/egmrp-daemon/compare/v2.1.1...v2.2.0) (2021-04-06)


### Features

* use alpine linux for smaller image size ([af8d001](https://github.com/Einfach-Gaming/egmrp-daemon/commit/af8d001e282377e474f48110f385c4811590de86))

## [2.1.1](https://github.com/Einfach-Gaming/egmrp-daemon/compare/v2.1.0...v2.1.1) (2021-04-06)


### Bug Fixes

* use github package registry ([6ed74d2](https://github.com/Einfach-Gaming/egmrp-daemon/commit/6ed74d208a9061531c7f610f5fc0c52c26f0d772)), closes [#39](https://github.com/Einfach-Gaming/egmrp-daemon/issues/39)

# [2.1.0](https://github.com/Einfach-Gaming/egmrp-daemon/compare/v2.0.4...v2.1.0) (2021-04-06)


### Bug Fixes

* **deps:** add pino to dependencies ([48566f7](https://github.com/Einfach-Gaming/egmrp-daemon/commit/48566f7faf7fb36792389d528339427af5bbbb3c))
* **deps:** add tslib to dependencies ([ccdcaa3](https://github.com/Einfach-Gaming/egmrp-daemon/commit/ccdcaa32615a5253456c2acb9422f76c50ed2bd1))
* **deps:** move yup to dependencies ([b612e92](https://github.com/Einfach-Gaming/egmrp-daemon/commit/b612e92bdd1e1a5b42db37e3dfc5eaeeac8918c5))
* **deps:** update dependency pino to v6.7.0 ([#15](https://github.com/Einfach-Gaming/egmrp-daemon/issues/15)) ([29948b9](https://github.com/Einfach-Gaming/egmrp-daemon/commit/29948b9fc62d6c89435ab659167370b2ee928095))
* **deps:** update dependency yup to v0.29.3 ([#16](https://github.com/Einfach-Gaming/egmrp-daemon/issues/16)) ([aeceff5](https://github.com/Einfach-Gaming/egmrp-daemon/commit/aeceff59a4e25eb5e5e2753d367914eaf6be276a))
* **deps:** use @types/node for version 12 and regenerate yarn.lock ([8f51a2a](https://github.com/Einfach-Gaming/egmrp-daemon/commit/8f51a2a996307c522ebb395aa502bbb3894d597d))
* allow empty whitelists ([295a11d](https://github.com/Einfach-Gaming/egmrp-daemon/commit/295a11de8c2cb1d512167c9e4b057cae6b8408cf))
* correctly parse whitelist ([d112edd](https://github.com/Einfach-Gaming/egmrp-daemon/commit/d112edd126dc4ecdb02ed4552211a06512d4f5df))
* load whitelist from parent folder ([160bbd2](https://github.com/Einfach-Gaming/egmrp-daemon/commit/160bbd23e42f0fbaf31e0a4b25b8bae79000948e))


### Features

* yup and pino, remove lodash and winston, dynamic whitelist loading ([c742ec2](https://github.com/Einfach-Gaming/egmrp-daemon/commit/c742ec2df666035c783fd2ccff6a0cfd7bde8446))

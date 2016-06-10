# Integrate
Extension for the [Critic code review system](https://github.com/jensl/critic) that simplifies integration back to master ( or the original branch ).

Supports automatic commenting in Jira and linking to Cgit if [jira-bts-api](https://github.com/jensl/jira-bts-api) is installed.

Note that as of now the extension assumes that all your tracked branches comes from the same source repository.

In addition in the rare case that your repository does not have a master branch you need to update the db to point to another branch. Example: `insert into extensionstorage values(N, 1, 'refbranch:REPONAME', 'BRANCH');` replacing N, REPONAME and BRANCH for your usecase.

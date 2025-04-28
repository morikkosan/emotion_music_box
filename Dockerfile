FROM ruby:3.2.3

RUN apt-get update -qq && apt-get install -y nodejs postgresql-client

WORKDIR /usr/src/app

COPY Gemfile* ./

RUN bundle install || true

COPY . .

CMD ["bash"]


# Only DNS/MX validation. SMTP probing is explicitly disabled.
require 'json'
require 'truemail'
input = JSON.parse(STDIN.read)
Truemail.configure do |config|
  config.verifier_email = 'contact.onefolk@gmail.com'
  config.default_validation_type = :mx
  config.connection_timeout = 3
  config.response_timeout = 3
  config.connection_attempts = 1
end
result = Truemail.validate(input.fetch('email'), with: :mx)
puts JSON.generate({email: input['email'], valid: result.result.valid?, mailbox_confirmed: false})

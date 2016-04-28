# # Generate with the command "thrift -gen js:node scribeServer.thrift"
# Used to create a mock Scribe server in node.js, for the integration test.
enum ResultCode {
  OK,
  TRY_LATER
}

struct LogEntry {
  1:  string category,
  2:  string message
}

service scribe {
  ResultCode Log(1: list<LogEntry> messages);
}

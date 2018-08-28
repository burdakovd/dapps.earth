#!/usr/bin/env python2

"""
Nano DNS server that receives a file name, and for all requests responds
with TXT records from that file.

If file gets removed, it dies. It also dies 10 minutes after starting.

Useful for passing ACME challenges.
"""

import sys, os
import pwd, grp
import daemon
from time import sleep
from dnslib import DNSLabel, QTYPE, RR, dns
from dnslib.server import DNSServer

VERBOSE=True

def records(name):
    try:
      ff = open(name)
    except IOError:
      sys.stderr.write("File {} not available, exiting\n".format(name))
      sys.exit(1)

    with ff as f:
        return sorted({line.strip() for line in f.readlines()})

class Resolver(object):
  def __init__(self, records_file):
      self._records_file = records_file

  def resolve(self, request, handler):
    reply = request.reply()
    zone = '\n'.join(
        '{} 1 TXT "{}"'.format(
            request.q.qname,
            txt.strip(),
        )
        for txt in records(self._records_file)
    )
    if VERBOSE:
        sys.stderr.write(repr(zone) + '\n')
    reply.add_answer(
        *RR.fromZone(
            zone
        )
    )
    return reply

def drop_privileges(user):
    # Get the uid/gid from the name
    runningUid = pwd.getpwnam(user).pw_uid
    runningGid = grp.getgrnam(user).gr_gid

    # Remove group privileges
    os.setgroups([])

    # Try setting the new uid/gid
    os.setgid(runningGid)
    os.setuid(runningUid)

if __name__ == '__main__':
  if len(sys.argv) != 3:
      sys.stderr.write("Usage: {} <user> <file_with_txt_records>\n".format(sys.argv[0]))
      sys.exit(1)

  user = sys.argv[1]
  records_file = os.path.abspath(sys.argv[2])
  os.chdir('/')
  records(records_file)
  resolver = Resolver(records_file)
  server = DNSServer(resolver, port=53)

  with daemon.DaemonContext(
    files_preserve=[server.server.fileno()],
    stderr=sys.stderr,
  ):
      drop_privileges(user)
      records(records_file)
      server.start_thread()

      for i in range(600):
          sleep(1)
          records(records_file)

      sys.stderr.write("Lived too long, exiting\n")
      sys.exit(0)

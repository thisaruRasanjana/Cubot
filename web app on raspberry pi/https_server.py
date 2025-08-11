#!/usr/bin/env python3
import http.server
import ssl
import socketserver
import os
from pathlib import Path

# Configuration
HOST = '172.20.10.5'
PORT = 9443
DIST_DIR = 'dist'

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Camera permissions
        self.send_header('Permissions-Policy', 'camera=*, microphone=*')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def create_self_signed_cert():
    """Create a self-signed certificate for HTTPS"""
    cert_file = 'server.crt'
    key_file = 'server.key'
    
    if not os.path.exists(cert_file) or not os.path.exists(key_file):
        print("🔐 Generating self-signed SSL certificate...")
        os.system(f'''
        openssl req -x509 -newkey rsa:4096 -keyout {key_file} -out {cert_file} -days 365 -nodes \
        -subj "/C=US/ST=State/L=City/O=Organization/CN={HOST}"
        ''')
    
    return cert_file, key_file

def main():
    # Create SSL certificate
    cert_file, key_file = create_self_signed_cert()
    
    # Create HTTPS server
    with socketserver.TCPServer((HOST, PORT), CORSHTTPRequestHandler) as httpd:
        # Wrap with SSL
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cert_file, key_file)
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
        
        print(f"🚀 HTTPS Server running at https://{HOST}:{PORT}")
        print(f"📱 Access from your phone: https://{HOST}:{PORT}")
        print(f"📸 Camera access should now work!")
        print(f"⚠️  You may see a security warning - click 'Advanced' and 'Proceed'")
        print(f"🛑 Press Ctrl+C to stop the server")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")

if __name__ == "__main__":
    main()

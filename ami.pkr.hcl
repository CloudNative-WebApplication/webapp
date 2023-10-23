packer {
  required_plugins {
    amazon = {
      source  = "github.com/hashicorp/amazon"
      version = "~> 1"
    }
  }
}

variable "aws_region" {
  type        = string
  description = "The aws region ID to use"
  default     = "us-east-1"
}


variable "demo_account_id" {
  type        = string
  description = "this is the demo accout id "
  default     = "389739722226"

}

variable "source_ami" {
  type        = string
  description = "The source AMI ID to use as a base"
  default     = "ami-06db4d78cb1d3bbf9"
}


variable "aws_access_key" {
  type        = string
  description = "AWS access key"
}

variable "aws_secret_access_key" {
  type        = string
  description = "AWS secret key"
}



source "amazon-ebs" "myami" {
  ami_name      = "CSYE6225_${formatdate("YYYY_MM_DD_hh_mm_ss", timestamp())}"
  source_ami    = var.source_ami
  instance_type = "t2.micro"
  ssh_username  = "admin"
  region        = var.aws_region

  access_key = var.aws_access_key
  secret_key = var.aws_secret_access_key


  ami_users = [var.demo_account_id]

}


build {
  sources = ["source.amazon-ebs.myami"]

  provisioner "shell" {
    inline = [
      "echo 'Customization steps here'",
      "sudo apt-get update",
      "echo 'Additional customization steps here'",
      "sudo apt install -y zip"
    ]
  }

  provisioner "file" {
    source      = "codefile.zip"
    destination = "~/codefile.zip"
  }

  provisioner "shell" {
    inline = [
      "sudo apt update",
      "sudo apt install -y nodejs npm",
      "sudo apt update",
      "sudo apt install -y mariadb-server",
      "sudo systemctl start mariadb",
      "sudo systemctl enable mariadb",
      "sudo apt install -y unzip",
      "sudo mysql_secure_installation <<EOF",
      "Sqlsru@19",
      "y",
      "y",
      "Sqlsru@19",
      "Sqlsru@19",
      "y",
      "y",
      "y",
      "y",
      "EOF",
      "unzip codefile.zip",
      "npm install",
      "npm uninstall bcrypt",
      "npm install bcrypt",
      "sudo apt remove git -y"
    ]
  }


}

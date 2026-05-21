import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const email = "klient3@gmail.com";
  
  console.log(`Searching for '${email}' in 'User' table...`);
  const users = await prisma.user.findMany({
    where: { email }
  });
  console.log("Users found:", JSON.stringify(users, null, 2));

  console.log(`\nSearching for '${email}' in 'Client' table...`);
  const clients = await prisma.client.findMany({
    where: { email }
  });
  console.log("Clients found:", JSON.stringify(clients, null, 2));

  if (users.length === 0 && clients.length === 0) {
    console.log("\nListing top 5 users and clients to see what's there:");
    const someUsers = await prisma.user.findMany({ take: 5 });
    console.log("Some Users:", JSON.stringify(someUsers, null, 2));
    const someClients = await prisma.client.findMany({ take: 5 });
    console.log("Some Clients:", JSON.stringify(someClients, null, 2));
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
